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
      toast({ variant: 'destructive', title: 'Podaj adres email', description: 'Wpisz swój email, aby zresetować hasło.' });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Błąd', description: error.message });
    } else {
      toast({ title: 'Email wysłany', description: 'Sprawdź swoją skrzynkę – wysłaliśmy link do resetowania hasła.' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[hsl(222,47%,6%)]">
      <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl border border-white/[0.08] bg-[hsl(222,40%,10%)]">
        {/* TOPTECH Logo */}
        <div className="flex justify-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            TOPTECH<span className="text-[hsl(217,91%,60%)]">®</span>
          </h1>
        </div>

        <p className="text-center mb-8 text-[hsl(215,20%,65%)] text-sm">
          Zaloguj się do Systemu Wycen
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[hsl(215,20%,80%)]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(215,15%,40%)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@toptech.pl"
                required
                className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-[hsl(215,15%,35%)] outline-none transition-all border border-white/10 bg-[hsl(222,47%,6%)] focus:border-[hsl(217,91%,50%)] focus:ring-2 focus:ring-[hsl(217,91%,50%)]/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[hsl(215,20%,80%)]">Hasło</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(215,15%,40%)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-[hsl(215,15%,35%)] outline-none transition-all border border-white/10 bg-[hsl(222,47%,6%)] focus:border-[hsl(217,91%,50%)] focus:ring-2 focus:ring-[hsl(217,91%,50%)]/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 bg-gradient-to-r from-[hsl(217,91%,50%)] to-[hsl(217,91%,45%)]"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Zaloguj się
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-[hsl(215,15%,40%)] hover:text-[hsl(217,91%,60%)] transition-colors"
          >
            Zapomniałeś hasła?
          </button>
        </div>
      </div>
    </div>
  );
}
