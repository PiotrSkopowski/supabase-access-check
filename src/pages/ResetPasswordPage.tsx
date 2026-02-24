import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Hasło za krótkie', description: 'Minimum 6 znaków.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ variant: 'destructive', title: 'Błąd', description: error.message });
    } else {
      toast({ title: 'Hasło zmienione', description: 'Możesz się teraz zalogować.' });
      navigate('/');
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <p style={{ color: '#94a3b8' }}>Nieprawidłowy link resetowania hasła.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0f172a' }}>
      <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl border" style={{ background: '#1e293b', borderColor: 'rgba(255,255,255,0.08)' }}>
        <h1 className="text-2xl font-bold text-white text-center mb-6">Ustaw nowe hasło</h1>
        <form onSubmit={handleReset} className="space-y-5">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#64748b' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nowe hasło (min. 6 znaków)"
              required
              className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none border"
              style={{ background: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz hasło
          </button>
        </form>
      </div>
    </div>
  );
}
