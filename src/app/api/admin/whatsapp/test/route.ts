import { fail, HttpError, ok, readBody } from "@/lib/http";
import { readAdminSession } from "@/lib/server/auth";
import { sendWhatsAppMessage } from "@/lib/server/otpService";

export async function POST(request: Request) {
  try {
    if (!(await readAdminSession())) throw new HttpError(401, "Admin authentication required");
    const body = await readBody<{ mobile: string; message?: string }>(request);
    if (!body.mobile) throw new HttpError(422, "Please provide a valid Indian mobile number");

    const message = body.message || `Your Skywear test OTP is:\n\n*${Math.floor(1000 + Math.random() * 9000)}*\n\n(Valid for 10 mins. Do not share)`;
    const sent = await sendWhatsAppMessage(body.mobile, message);

    if (!sent) {
      throw new HttpError(
        502,
        "WhatsApp message failed to deliver. Make sure you have scanned the QR code at https://zenin-whatsapp.onrender.com using 'Linked Devices' on your mobile WhatsApp."
      );
    }

    return ok({ success: true, message: `WhatsApp message delivered successfully to ${body.mobile}!` });
  } catch (error) {
    return fail(error);
  }
}
