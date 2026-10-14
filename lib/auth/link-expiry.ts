/**
 * How long emailed activation and password links stay valid, as worded
 * in emails and on the sign-in page.
 *
 * The real limit is Supabase's "Email OTP Expiration" (Authentication
 * -> Sign In / Providers -> Email), set to 86400 seconds = 24 hours, its
 * maximum. Change both together.
 */
export const EMAIL_LINK_EXPIRY_LABEL = '24 hours'
