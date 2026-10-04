// Where the app is running. On Vercel (and anywhere WORDSEED_READ_ONLY=1 is
// set) the server cannot keep files: runs and ratings live in each visitor's
// browser instead, and uploading text is turned off.
export const READ_ONLY = process.env.VERCEL === "1" || process.env.WORDSEED_READ_ONLY === "1";
