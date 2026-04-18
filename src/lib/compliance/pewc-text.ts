/**
 * TCPA Prior Express Written Consent text for earthmove.io driver SMS + location.
 * ANY CHANGE to disclosure text requires a new version string.
 * disclosure_text_sha256 = sha256(DISCLOSURE_TEXT) — written to sms_consent row for
 * litigation-grade proof of exactly what was shown to the user at consent time.
 */

export const PEWC_DISCLOSURE_V1_VERSION = 'v1_2026-04';

export const PEWC_DISCLOSURE_V1 = `By tapping ACCEPT, I provide my electronic signature and agree that earthmove.io and its dispatch operators may send me autodialed and automated text messages, including SMS and MMS, at the mobile number I provided, AT ANY TIME OF DAY INCLUDING BEFORE 8 A.M., for load dispatch, schedule changes, payment confirmations, safety alerts, and related operational purposes. I further consent to the collection and processing of my device location while a load session is active. Message frequency varies. Message and data rates may apply. My consent is not a condition of any purchase or of my engagement as a driver. I can reply STOP to cancel or HELP for help at any time. I consent to do business electronically under the federal E-SIGN Act (15 U.S.C. § 7001). See Privacy Policy at earthmove.io/privacy and SMS Terms at earthmove.io/sms.`;

export const PEWC_DISCLOSURE_ES_V1 = `Al tocar ACEPTAR, proporciono mi firma electrónica y acepto que earthmove.io y sus operadores de despacho pueden enviarme mensajes de texto automatizados, incluidos SMS y MMS, al número móvil que proporcioné, A CUALQUIER HORA DEL DÍA INCLUSO ANTES DE LAS 8 A.M., para despacho de cargas, cambios de horario, confirmaciones de pago, alertas de seguridad y propósitos operacionales relacionados. Además consiento la recopilación y procesamiento de mi ubicación del dispositivo mientras una sesión de carga esté activa. La frecuencia de mensajes varía. Pueden aplicar tarifas de mensajes y datos. Mi consentimiento no es una condición de compra ni de mi participación como conductor. Puedo responder ALTO para cancelar o AYUDA para obtener ayuda en cualquier momento. Consiento hacer negocios electrónicamente bajo la Ley Federal E-SIGN (15 U.S.C. § 7001). Ver Política de Privacidad en earthmove.io/privacy y Términos SMS en earthmove.io/sms.`;

import { createHash } from 'node:crypto';

export function disclosureSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
