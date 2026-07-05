// Gmail SMTP로 인증 메일 발송 (nodemailer). 자격증명은 env로만 주입.
// GMAIL_APP_PASSWORD는 구글 "앱 비밀번호"(2단계 인증 계정에서 발급하는 앱 전용 비밀번호)로,
// 실제 계정 비밀번호가 아니라서 유출돼도 이 용도만 폐기하면 된다.
// 개인 Gmail은 일 발송량 한도가 있어 사용자 규모가 커지면 전용 발송 서비스로 교체 예정.
const nodemailer = require('nodemailer')

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
const API_BASE = process.env.API_BASE || 'https://161.33.11.111.nip.io'
const APP_URL = process.env.APP_URL || 'https://weatherwear-jade.vercel.app'

const enabled = !!(GMAIL_USER && GMAIL_APP_PASSWORD)
const transporter = enabled
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
  : null

async function sendVerifyEmail(to, token) {
  if (!enabled) throw new Error('메일 발송이 설정되지 않았습니다.')
  const link = `${API_BASE}/auth/verify?token=${token}`
  await transporter.sendMail({
    from: `WeatherWear <${GMAIL_USER}>`,
    to,
    subject: 'WeatherWear 이메일 인증',
    text: `WeatherWear 가입을 완료하려면 아래 링크로 이메일을 인증하세요:\n${link}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    html: `<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:28px 24px">
      <div style="font-size:20px;font-weight:800;color:#111;margin-bottom:8px">WeatherWear</div>
      <div style="font-size:15px;color:#444;margin-bottom:20px">가입을 완료하려면 이메일을 인증해주세요.</div>
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700;font-size:14px">이메일 인증하기</a>
      <div style="font-size:12px;color:#999;margin-top:22px;word-break:break-all">버튼이 안 되면 이 주소를 복사해 여세요:<br>${link}</div>
    </div>`,
  })
}

// 가입 전 이메일 인증번호 (6자리, 폼에 입력)
async function sendCodeEmail(to, code) {
  if (!enabled) throw new Error('메일 발송이 설정되지 않았습니다.')
  await transporter.sendMail({
    from: `WeatherWear <${GMAIL_USER}>`,
    to,
    subject: `WeatherWear 인증코드 ${code}`,
    text: `WeatherWear 가입 인증코드: ${code}\n10분 안에 가입 화면에 입력하세요.\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    html: `<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:28px 24px">
      <div style="font-size:20px;font-weight:800;color:#111;margin-bottom:8px">WeatherWear</div>
      <div style="font-size:15px;color:#444;margin-bottom:20px">가입 화면에 아래 인증코드를 입력하세요. 10분 동안 유효해요.</div>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#111;background:#f4f4f4;border-radius:12px;padding:18px 0;text-align:center">${code}</div>
      <div style="font-size:12px;color:#999;margin-top:22px">본인이 요청하지 않았다면 이 메일을 무시하세요.</div>
    </div>`,
  })
}

async function sendResetEmail(to, token) {
  if (!enabled) throw new Error('메일 발송이 설정되지 않았습니다.')
  const link = `${API_BASE}/auth/reset?token=${token}`
  await transporter.sendMail({
    from: `WeatherWear <${GMAIL_USER}>`,
    to,
    subject: 'WeatherWear 비밀번호 재설정',
    text: `아래 링크에서 새 비밀번호를 설정하세요 (1시간 안에만 유효):\n${link}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않습니다.`,
    html: `<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:28px 24px">
      <div style="font-size:20px;font-weight:800;color:#111;margin-bottom:8px">WeatherWear</div>
      <div style="font-size:15px;color:#444;margin-bottom:20px">아래 버튼에서 새 비밀번호를 설정하세요. 링크는 1시간 동안만 유효해요.</div>
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700;font-size:14px">비밀번호 재설정</a>
      <div style="font-size:12px;color:#999;margin-top:22px;word-break:break-all">본인이 요청하지 않았다면 이 메일을 무시하세요. 버튼이 안 되면 이 주소를 복사해 여세요:<br>${link}</div>
    </div>`,
  })
}

module.exports = { sendVerifyEmail, sendCodeEmail, sendResetEmail, mailerEnabled: enabled }
