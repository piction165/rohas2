const express = require("express");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const router = express.Router();


// ✅ 로그인 API (관리자 & 일반 사용자 구분)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ message: "아이디가 존재하지 않습니다." });

    // ✅ 일반 사용자는 승인 여부 확인
    if (user.role !== "admin" && !user.isApproved) {
      return res.status(403).json({ message: "관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다." });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "비밀번호가 올바르지 않습니다." });

    // ✅ JWT 토큰 생성 (role 포함)
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, userId: user._id, username: user.username, role: user.role });
  } catch (error) {
    res.status(500).json({ error: "로그인 실패" });
  }
  
// ✅ 승인 대기 중인 가입자 목록 조회 API (관리자만 접근 가능)
router.get("/pending-users", authMiddleware, async (req, res) => {
  try {
    // 승인되지 않은 사용자 조회
    const pendingUsers = await User.find({ isApproved: false }).select("-password");
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ error: "승인 대기 사용자 목록 조회 실패" });
  }
});

// ✅ 관리자 회원 승인 API (관리자만 접근 가능)
router.put("/approve/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    user.isApproved = true;
    await user.save();

    res.json({ message: "사용자 승인 완료!" });
  } catch (error) {
    res.status(500).json({ error: "회원 승인 처리 실패" });
  }
});


// ✅ 회사 이메일 설정 (여기에 회사 이메일 주소 입력)
const ADMIN_EMAIL = "piction165@eyonsei.ac.kr";


// ✅ Nodemailer 이메일 설정
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "piction165@eyonsei.ac.kr", // 발신자 이메일 (Gmail 사용 가능)
    pass: "Plaes165!", // 앱 비밀번호 (보안 설정 필요)
  },
});
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ message: "아이디가 존재하지 않습니다." });

    // ✅ 승인 여부 확인
    if (!user.isApproved) {
      return res.status(403).json({ message: "관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다." });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "비밀번호가 올바르지 않습니다." });

    // JWT 토큰 생성
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token, userId: user._id, username: user.username });
  } catch (error) {
    res.status(500).json({ error: "로그인 실패" });
  }
});


// ✅ 회원가입 요청 (관리자 승인 대기)
router.post("/register", async (req, res) => {
  try {
    const { username, email, phoneNumber, password } = req.body;

    // 연락처 중복 확인
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) return res.status(400).json({ message: "이미 등록된 전화번호입니다." });

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 정보 저장 (기본적으로 승인 대기)
    const newUser = new User({
      username,
      email,
      phoneNumber,
      password: hashedPassword,
      isApproved: false, // 기본값: 승인 대기
    });

    await newUser.save();

    // ✅ 관리자에게 이메일 발송 (회원가입 승인 요청)
    const mailOptions = {
      from: "your-email@gmail.com",
      to: ADMIN_EMAIL,
      subject: "새로운 회원가입 승인 요청",
      text: `새로운 회원가입 요청이 있습니다.
      - 이름: ${username}
      - 이메일: ${email}
      - 연락처: ${phoneNumber}
      
      회원을 승인하려면 관리자 페이지에서 확인하세요.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: "회원가입 요청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다." });
  } catch (error) {
    res.status(500).json({ error: "회원가입 요청 실패" });
  }
  
});
