import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Błąd logowania',
        description: error.message === 'Invalid login credentials'
          ? 'Nieprawidłowy email lub hasło.'
          : error.message,
      });
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Podaj adres email',
        description: 'Wpisz swój email, aby zresetować hasło.',
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Błąd', description: error.message });
    } else {
      toast({
        title: 'Email wysłany',
        description: 'Sprawdź swoją skrzynkę – wysłaliśmy link do resetowania hasła.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0f172a' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl border"
        style={{
          background: '#1e293b',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Logo placeholder */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
            TT
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1">Toptech Polska</h1>
        <p className="text-center mb-8" style={{ color: '#94a3b8' }}>
          Zaloguj się do Systemu Wycen
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: '#cbd5e1' }}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#64748b' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@toptech.pl"
                required
                className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-all border focus:ring-2"
                style={{
                  background: '#0f172a',
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.3)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: '#cbd5e1' }}>Hasło</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#64748b' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-all border focus:ring-2"
                style={{
                  background: '#0f172a',
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.3)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Zaloguj się
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm hover:underline transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            Zapomniałeś hasła?
          </button>
        </div>
      </div>
    </div>
  );
}
