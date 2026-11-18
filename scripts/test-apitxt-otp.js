const { sendMobileOtp, verifyMobileOtp } = require('../src/lib/server/otpService');
require('dotenv').config();

async function test() {
  console.log('Testing APITxT SMS OTP dispatch...');
  const res = await sendMobileOtp('919999999999', '1234');
  console.log('sendMobileOtp result:', res);

  console.log('Verifying test OTP 1234...');
  const verifyRes = await verifyMobileOtp('919999999999', '1234');
  console.log('verifyMobileOtp result:', verifyRes);
}

test().catch(console.error);
