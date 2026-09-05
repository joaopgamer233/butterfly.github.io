"use strict";

const nodemailer =
    require("nodemailer");


const transporter =
    nodemailer.createTransport({

        host:
            process.env.BUTTERFLY_SMTP_HOST,

        port:
            Number(
                process.env.BUTTERFLY_SMTP_PORT ||
                587
            ),

        secure:
            process.env.BUTTERFLY_SMTP_SECURE ===
            "true",

        auth: {

            user:
                process.env.BUTTERFLY_SMTP_USER,

            pass:
                process.env.BUTTERFLY_SMTP_PASS

        }

    });


const FROM =
    process.env.BUTTERFLY_EMAIL_FROM ||
    process.env.BUTTERFLY_SMTP_USER;


async function sendCode(
    email,
    code,
    subject,
    purpose
) {

    await transporter.sendMail({

        from: FROM,
        to: email,
        subject,

        text:
`Butterfly

Your ${purpose} code is:

${code}

This code expires in 10 minutes.

If you did not request this, you can ignore this email.`

    });

}


async function sendVerificationEmail(
    email,
    verificationUrl,
    code
) {

    await transporter.sendMail({

        from: FROM,
        to: email,
        subject: "Verify your Butterfly account",

        text:
`Welcome to Butterfly!

Click this link to verify your email address:

${verificationUrl}

Or enter this verification code in Butterfly:

${code}

The link and code expire in 10 minutes.

If you did not create a Butterfly account, you can ignore this email.`,

        html:
`<!doctype html>
<html>
<body style="margin:0;padding:0;background:#171722;font-family:Arial,sans-serif;color:#ffffff;">
<div style="max-width:560px;margin:40px auto;padding:32px;background:#242438;border-radius:18px;">
<h1 style="margin-top:0;">Welcome to Butterfly 🦋</h1>
<p style="color:#d0d0df;line-height:1.6;">Thanks for creating a Butterfly account. Click the button below to verify your email address.</p>
<p style="text-align:center;margin:32px 0;">
<a href="${verificationUrl}" style="display:inline-block;padding:14px 24px;background:#ffffff;color:#171722;text-decoration:none;border-radius:10px;font-weight:bold;">Verify my email</a>
</p>
<p style="color:#d0d0df;line-height:1.6;">If the button does not work, copy this link into your browser:</p>
<p style="word-break:break-all;color:#9fc5ff;">${verificationUrl}</p>
<hr style="border:0;border-top:1px solid #3b3b50;margin:28px 0;">
<p style="color:#d0d0df;">You can also enter this code in Butterfly:</p>
<p style="font-size:28px;letter-spacing:8px;font-weight:bold;text-align:center;">${code}</p>
<p style="color:#88889c;font-size:13px;">This link and code expire in 10 minutes. If you did not create this account, you can ignore this email.</p>
</div>
</body>
</html>`

    });

}


module.exports = {
    sendCode,
    sendVerificationEmail
};
