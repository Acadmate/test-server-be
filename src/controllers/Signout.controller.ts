import { Context } from 'hono';

/**
 * Signs out a user by clearing their authentication tokens
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @returns Response object
 */
export const SignOut = async (c: Context): Promise<Response> => {
  try {
    console.debug('SignOut: Starting sign-out process');
    const isProduction = process.env.NODE_ENV === 'production';
    console.debug('SignOut: Environment isProduction:', isProduction);

    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax' as 'none' | 'lax',
      domain: isProduction ? '.acadmate.in' : undefined,
      path: '/',
    };
    console.debug('SignOut: Cookie options:', cookieOpts);

    c.res.headers.set('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0');
    console.debug('SignOut: Cleared authentication token cookie');

    return c.json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('SignOut: Error during sign-out process:', error);

    try {
      const isProduction = process.env.NODE_ENV === 'production';
      console.debug('SignOut: Error handling - Environment isProduction:', isProduction);

      const cookieOpts = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax' as 'none' | 'lax',
        domain: isProduction ? '.acadmate.in' : undefined,
        path: '/',
      };
      console.debug('SignOut: Error handling - Cookie options:', cookieOpts);

      c.res.headers.set('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0');
      console.debug('SignOut: Error handling - Cleared authentication token cookie');
    } catch (cookieError) {
      console.error('SignOut: Error clearing cookies during error handling:', cookieError);
    }

    return c.json({
      success: false,
      message: 'Failed to sign out',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : String(error)
    });
  }
};
