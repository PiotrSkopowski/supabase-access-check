import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, Mail } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import toptechLogo from '@/assets/toptech-logo.svg';

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl border border-border bg-card">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={toptechLogo}
            alt="TOPTECH"
            className="h-9 w-auto dark:brightness-0 dark:invert"
          />
        </div>

        <p className="text-center mb-8 text-muted-foreground text-sm">
          Zaloguj się do Systemu Wycen
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jan@toptech.pl"
                required
                className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all border border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Hasło</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all border border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-primary-foreground font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 bg-primary"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Zaloguj się
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Zapomniałeś hasła?
          </button>
        </div>
      </div>
    </div>
  );
}
