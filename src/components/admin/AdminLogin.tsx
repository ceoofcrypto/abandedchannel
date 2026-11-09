import React, { useState } from 'react';
import { loginAdminWithGoogle } from '../../services/api.ts';
import { AdminUser } from '../../types/index.ts';
import { AlertCircle, X } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
  onBackToSite: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToSite }) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await loginAdminWithGoogle();
      onLoginSuccess(result.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('auth/popup-closed-by-user')) {
          setError('Sign-in popup was closed.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Authentication failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-xs bg-[#14161b] border border-neutral-800/90 rounded-2xl p-6 pt-10 shadow-2xl flex flex-col items-center gap-4">
        <button
          onClick={onBackToSite}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {error && (
          <div className="w-full p-3 rounded-xl bg-red-950/60 border border-red-800/80 flex items-center gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-neutral-950 text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
            />
          </svg>
          <span>{isSubmitting ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>
      </div>
    </div>
  );
};
