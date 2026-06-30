// Gmail SMTP로 인증 메일 발송 (nodemailer). 자격증명은 env로만 주입.
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

module.exports = { sendVerifyEmail, mailerEnabled: enabled }
