
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/NeumorphicUI';
import { Lock, User, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Login: React.FC = () => {
  const { login, createUserByAdmin, t, user, isAuthRestricted } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password || (isRegistering && !name)) {
        setError('يرجى إدخال كافة البيانات المطلوبة');
        return;
    }

    setIsLoading(true);

    try {
      let result;
      if (isRegistering) {
        result = await createUserByAdmin(email.trim(), password, name, 'admin'); // Create first user as admin
        if(result) {
            // After successful registration, log them in
            result = await login(email.trim(), password);
        }
      } else {
        result = await login(email.trim(), password);
      }
      
      if (result) setSuccess(true);
    } catch (err: any) {
      console.error("Auth Error Details:", err.code, err.message);
      let errMsg = 'خطأ في المصادقة السحابية';
      
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errMsg = 'بيانات الدخول غير صحيحة أو الحساب غير موجود. لقد قمنا بتحويلك لإنشاء حساب جديد.';
          setIsRegistering(true); // Auto-switch to register mode
          break;
        case 'auth/operation-not-allowed':
          errMsg = 'يرجى تفعيل (Email/Password) من لوحة تحكم Firebase > Authentication > Sign-in method';
          break;
        case 'auth/invalid-email':
          errMsg = 'صيغة البريد الإلكتروني غير صحيحة.';
          break;
        case 'auth/user-disabled':
          errMsg = 'تم تعطيل هذا الحساب من قبل الإدارة.';
          break;
        case 'auth/network-request-failed':
          errMsg = 'خطأ في الاتصال بالسحابة. يرجى التأكد من: \n 1. إضافة نطاق التطبيق (Authorized Domain) في لوحة تحكم Firebase. \n 2. عدم وجود جدار حماية يحجب الاتصال بـ firebaseapp.com. \n 3. المحاولة من متصفح لا يحجب ملفات تعريف الارتباط الخارجية.';
          break;
        case 'auth/too-many-requests':
          errMsg = 'تم حظر الدخول مؤقتاً بسبب محاولات خاطئة متكررة. حاول لاحقاً.';
          break;
        default:
          errMsg = `فشل العملية: ${err.code || 'خطأ غير معروف'}`;
      }
      setError(errMsg);
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4 font-cairo relative" 
      dir="rtl"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <GlassCard className="flex flex-col gap-6 items-center py-10 px-10 shadow-2xl rounded-[3rem] border border-white">
          
          <div className="relative mb-1">
            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
               <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-[2rem] flex items-center justify-center shadow-xl relative z-10 border-4 border-white/50">
                  {isLoading ? <Loader2 className="text-white w-8 h-8 animate-spin" /> : <Lock className="text-white w-8 h-8" />}
               </div>
          </div>
          
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-800 mb-1">دخول النظام السحابي</h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Cloud Enterprise Solution 2026</p>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 mt-2">
            
            <AnimatePresence mode="wait">
                {isAuthRestricted && !user && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-50 text-amber-700 p-3 rounded-2xl border border-amber-200 flex flex-col gap-1 text-[10px] font-bold shadow-sm"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>تنبيه أمني: الدخول المجهول معطل</span>
                        </div>
                        <p className="opacity-80">يرجى تسجيل الدخول بحسابك الخاص.</p>
                    </motion.div>
                )}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-red-50 text-red-600 p-3 rounded-2xl border border-red-100 flex items-start gap-3 text-xs font-bold shadow-sm"
                    >
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </motion.div>
                )}
                {success && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl border border-emerald-100 flex items-center gap-3 text-xs font-bold shadow-sm"
                    >
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>تمت العملية بنجاح.. جاري التحميل</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 mr-2 uppercase tracking-wider flex items-center gap-1">
                <User size={10} /> البريد الإلكتروني
              </label>
              <input 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading || success}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-700 shadow-inner disabled:opacity-50"
                placeholder="user@dakahlia.net"
                required
              />
            </div>

            {isRegistering && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 mr-2 uppercase tracking-wider flex items-center gap-1">
                  <User size={10} /> الاسم بالكامل
                </label>
                <input 
                  type="text"
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  disabled={isLoading || success}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-700 shadow-inner disabled:opacity-50"
                  placeholder="أحمد حمدان"
                  required={isRegistering}
                />
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 mr-2 uppercase tracking-wider flex items-center gap-1">
                <Lock size={10} /> كلمة المرور
              </label>
              <input 
                type="password"
                value={password} 
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading || success}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-700 shadow-inner disabled:opacity-50"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <button 
                type="submit" 
                disabled={isLoading || success}
                className={`
                  w-full py-4 rounded-[1.2rem] font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden active:scale-95
                  ${isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : success ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 border-b-4 border-blue-900'}
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>جاري المعالجة...</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 size={24} />
                    <span>اكتملت العملية</span>
                  </>
                ) : (
                  <>
                    <span>{isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</span>
                    <div className="bg-white/20 p-1 rounded-lg">
                      <ArrowRight className="rotate-180" size={18} />
                    </div>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="w-full text-center mt-2">
            <button 
              type="button" 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-blue-600 font-bold text-sm hover:underline"
            >
              {isRegistering ? 'لديك حساب أدمين بالفعل؟ تسجيل دخول' : 'هل هذا أول استخدام؟ إنشاء حساب مدير'}
            </button>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 w-full text-center">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">© 2026 Al-Makhazen Secure Cloud Infrastructure</p>
          </div>
          
        </GlassCard>
      </motion.div>
    </div>
  );
};
