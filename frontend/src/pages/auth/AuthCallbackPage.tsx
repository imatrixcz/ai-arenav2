import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (accessToken && refreshToken) {
      loginWithTokens(accessToken, refreshToken)
        .then(() => navigate('/dashboard'))
        .catch(() => setError('Failed to complete authentication'));
    } else {
      setError('Missing authentication tokens');
    }
  }, [loginWithTokens, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-white mb-2">Authentication Failed</h1>
          <p className="text-dark-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="py-2.5 px-6 bg-dark-800 border border-dark-700 text-white font-medium rounded-lg hover:bg-dark-700 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-dark-400">Completing authentication...</p>
      </div>
    </div>
  );
}
