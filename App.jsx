import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Lock, LogOut, ShieldCheck, Search, Trash2, Edit3,
  Download, Cloud, ArrowUpRight, ArrowDownLeft, UserPlus,
  BookOpen, KeyRound, Settings, RefreshCw, X
} from 'lucide-react';
import { getSupabase, isCloudConfigured, saveCloudConfig } from './supabaseClient';

export default function App() {
  const [supabase, setSupabase] = useState(() => getSupabase());
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [showCloudSetup, setShowCloudSetup] = useState(!isCloudConfigured());
  const [sbUrlInput, setSbUrlInput] = useState(localStorage.getItem('hk_sb_url') || '');
  const [sbKeyInput, setSbKeyInput] = useState(localStorage.getItem('hk_sb_key') || '');

  const [customers, setCustomers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickTab, setQuickTab] = useState('entry');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const [entryCustomerId, setEntryCustomerId] = useState('');
  const [entryType, setEntryType] = useState('gave');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);

  const [verifyModal, setVerifyModal] = useState({
    open: false,
    title: '',
    description: '',
    onSuccess: null
  });
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  const showMessage = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id, supabase);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.id, supabase);
      } else {
        setCustomers([]);
        setEntries([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const loadUserData = async (uid, client = supabase) => {
    if (!client || !uid) return;
    setSyncing(true);
    try {
      const { data: custData, error: custErr } = await client
        .from('customers')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      const { data: entData, error: entErr } = await client
        .from('entries')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (!custErr && custData) {
        setCustomers(custData);
        localStorage.setItem(`hk_cust_${uid}`, JSON.stringify(custData));
      } else {
        const cached = localStorage.getItem(`hk_cust_${uid}`);
        if (cached) setCustomers(JSON.parse(cached));
      }

      if (!entErr && entData) {
        setEntries(entData);
        localStorage.setItem(`hk_ent_${uid}`, JSON.stringify(entData));
      } else {
        const cached = localStorage.getItem(`hk_ent_${uid}`);
        if (cached) setEntries(JSON.parse(cached));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setShowCloudSetup(true);
      showMessage('پہلے کلاؤڈ بیک اپ سیٹ اپ مکمل کریں', 'error');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        if (password.length < 6) {
          throw new Error('پاسورڈ کم از کم 6 حروف کا ہونا ضروری ہے');
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() || 'صارف' } }
        });
        if (error) throw error;
        if (data?.user) {
          showMessage('اکاؤنٹ کامیابی سے بن گیا!');
          if (data.session) setUser(data.user);
        }
      } else if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        setUser(data.user);
        showMessage('خوش آمدید! آپ کا تمام ڈیٹا محفوظ ہے۔');
      } else if (authMode === 'forgot') {
        if (!email.trim()) throw new Error('براہ کرم اپنا ای میل درج کریں');
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        showMessage('پاسورڈ ری سیٹ لنک آپ کی ای میل پر بھیج دیا گیا ہے!');
        setAuthMode('login');
      }
    } catch (err) {
      showMessage(err.message || 'خرابی پیش آئی', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const requestPasswordVerification = (title, description, actionCallback) => {
    setVerifyPasswordInput('');
    setVerifyModal({
      open: true,
      title,
      description,
      onSuccess: actionCallback
    });
  };

  const confirmVerification = async (e) => {
    e.preventDefault();
    if (!verifyPasswordInput) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: verifyPasswordInput
      });
      if (error) {
        showMessage('غلط پاسورڈ! تصدیق ناکام ہو گئی۔', 'error');
        setVerifying(false);
        return;
      }
      const callback = verifyModal.onSuccess;
      setVerifyModal({ open: false, title: '', description: '', onSuccess: null });
      setVerifyPasswordInput('');
      if (callback) await callback();
    } catch (err) {
      showMessage('تصدیق میں خرابی پیش آئی', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddCustomer = (e) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    const nameCopy = newCustName.trim();
    const phoneCopy = newCustPhone.trim();

    requestPasswordVerification(
      'نیا کھاتہ دار شامل کریں',
      `"${nameCopy}" کا نیا کھاتہ کھولنے کے لیے اپنا اکاؤنٹ پاسورڈ درج کریں:`,
      async () => {
        const { data, error } = await supabase
          .from('customers')
          .insert([{ user_id: user.id, name: nameCopy, phone: phoneCopy }])
          .select()
          .single();
        if (error) {
          showMessage('کھاتہ محفوظ کرنے میں خرابی: ' + error.message, 'error');
          return;
        }
        const updated = [data, ...customers];
        setCustomers(updated);
        localStorage.setItem(`hk_cust_${user.id}`, JSON.stringify(updated));
        setNewCustName('');
        setNewCustPhone('');
        setEntryCustomerId(data.id);
        setQuickTab('entry');
        showMessage('نیا کھاتہ دار کامیابی سے محفوظ ہو گیا!');
      }
    );
  };

  const handleDeleteCustomer = (cust) => {
    requestPasswordVerification(
      'کھاتہ دار حذف (Delete) کریں',
      `خبردار! "${cust.name}" اور اس کی تمام انٹریاں ہمیشہ کے لیے ختم ہو جائیں گی۔ تصدیق کے لیے پاسورڈ درج کریں:`,
      async () => {
        await supabase.from('entries').delete().eq('customer_id', cust.id).eq('user_id', user.id);
        const { error } = await supabase.from('customers').delete().eq('id', cust.id).eq('user_id', user.id);
        if (error) {
          showMessage('حذف کرنے میں خرابی: ' + error.message, 'error');
          return;
        }
        setCustomers((prev) => prev.filter((c) => c.id !== cust.id));
        setEntries((prev) => prev.filter((e) => e.customer_id !== cust.id));
        if (selectedCustomerId === cust.id) setSelectedCustomerId(null);
        showMessage('کھاتہ دار کا ریکارڈ حذف کر دیا گیا۔');
      }
    );
  };

  const handleSaveEntry = (e) => {
    e.preventDefault();
    const targetCustId = entryCustomerId || selectedCustomerId;
    const amt = parseFloat(entryAmount);
    if (!targetCustId || isNaN(amt) || amt <= 0) {
      showMessage('براہ کرم کھاتہ دار اور درست رقم منتخب کریں', 'error');
      return;
    }

    const actionTitle = editingEntry ? 'انٹری تبدیل (Edit) کریں' : 'نئی انٹری محفوظ کریں';
    const actionDesc = editingEntry
      ? `رقم ${amt} روپے کی تبدیلی محفوظ کرنے کے لیے پاسورڈ درج کریں:`
      : `${amt} روپے کی نئی انٹری درج کرنے کے لیے پاسورڈ لکھیں:`;

    requestPasswordVerification(actionTitle, actionDesc, async () => {
      if (editingEntry) {
        const { data, error } = await supabase
          .from('entries')
          .update({
            customer_id: targetCustId,
            type: entryType,
            amount: amt,
            note: entryNote.trim()
          })
          .eq('id', editingEntry.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          showMessage('اپڈیٹ ناکام: ' + error.message, 'error');
          return;
        }
        setEntries((prev) => prev.map((item) => (item.id === data.id ? data : item)));
        showMessage('انٹری کامیابی سے اپڈیٹ اور محفوظ ہو گئی!');
      } else {
        const { data, error } = await supabase
          .from('entries')
          .insert([{
            user_id: user.id,
            customer_id: targetCustId,
            type: entryType,
            amount: amt,
            note: entryNote.trim()
          }])
          .select()
          .single();

        if (error) {
          showMessage('انٹری محفوظ نہیں ہو سکی: ' + error.message, 'error');
          return;
        }
        setEntries((prev) => [data, ...prev]);
        showMessage('انٹری فوری طور پر کلاؤڈ میں محفوظ ہو گئی!');
      }

      setEntryAmount('');
      setEntryNote('');
      setEditingEntry(null);
      setShowQuickModal(false);
    });
  };

  const handleDeleteEntry = (entry) => {
    requestPasswordVerification(
      'انٹری ڈیلیٹ کریں',
      `${entry.amount} روپے کی یہ انٹری ڈیلیٹ کرنے کے لیے پاسورڈ درج کریں:`,
      async () => {
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('id', entry.id)
          .eq('user_id', user.id);
        if (error) {
          showMessage('ڈیلیٹ ناکام: ' + error.message, 'error');
          return;
        }
        setEntries((prev) => prev.filter((item) => item.id !== entry.id));
        showMessage('انٹری محفوظ طریقے سے ڈیلیٹ کر دی گئی۔');
      }
    );
  };

  const handleExportBackup = () => {
    const backupPayload = {
      app: 'حساب کتاب',
      exportedAt: new Date().toISOString(),
      userEmail: user?.email,
      customers,
      entries
    };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HisabKitab_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('مکمل بیک اپ فائل ڈاؤن لوڈ ہو گئی!');
  };

  const customerBalances = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      map[c.id] = { gave: 0, got: 0, net: 0 };
    });
    entries.forEach((e) => {
      if (!map[e.customer_id]) map[e.customer_id] = { gave: 0, got: 0, net: 0 };
      if (e.type === 'gave') map[e.customer_id].gave += Number(e.amount);
      else map[e.customer_id].got += Number(e.amount);
      map[e.customer_id].net = map[e.customer_id].gave - map[e.customer_id].got;
    });
    return map;
  }, [customers, entries]);

  const totals = useMemo(() => {
    let totalGave = 0;
    let totalGot = 0;
    entries.forEach((e) => {
      if (e.type === 'gave') totalGave += Number(e.amount);
      else totalGot += Number(e.amount);
    });
    return { totalGave, totalGot, net: totalGave - totalGot };
  }, [entries]);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedCustomerEntries = entries.filter((e) => e.customer_id === selectedCustomerId);

  if (showCloudSetup) {
    return (
      <div className="min-h-screen bg-emerald-950 text-white flex flex-col justify-center p-5">
        <div className="max-w-md mx-auto w-full bg-white text-slate-900 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <img src="./icon-192.png" alt="حساب کتاب" className="w-14 h-14 rounded-2xl shadow" />
            <div>
              <h1 className="text-2xl font-bold text-emerald-900">حساب کتاب کلاؤڈ سیٹ اپ</h1>
              <p className="text-xs text-slate-500">ڈیٹا ہمیشہ محفوظ رکھنے کے لیے (صرف ایک بار)</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            تاکہ ایپ ڈیلیٹ ہونے پر بھی آپ کا ڈیٹا اور پاسورڈ سسٹم ضائع نہ ہو، اپنا مفت Supabase Project URL اور Anon Key درج کریں:
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Project URL</label>
              <input
                type="url"
                dir="ltr"
                placeholder="https://xyzcompany.supabase.co"
                value={sbUrlInput}
                onChange={(e) => setSbUrlInput(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Anon Public Key</label>
              <input
                type="text"
                dir="ltr"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                value={sbKeyInput}
                onChange={(e) => setSbKeyInput(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <button
              onClick={() => {
                if (!sbUrlInput.startsWith('http') || !sbKeyInput) {
                  showMessage('درست URL اور Key درج کریں', 'error');
                  return;
                }
                saveCloudConfig(sbUrlInput, sbKeyInput);
                setSupabase(getSupabase());
                setShowCloudSetup(false);
                showMessage('کلاؤڈ بیک اپ منسلک ہو گیا!');
              }}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-lg transition"
            >
              محفوظ کریں اور آگے بڑھیں
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-slate-900 flex flex-col justify-center p-5">
        {toast && (
          <div className={`fixed top-4 left-4 right-4 z-50 p-3.5 rounded-2xl shadow-xl text-white text-sm font-bold text-center ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {toast.text}
          </div>
        )}
        <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <img src="./icon-192.png" alt="حساب کتاب" className="w-20 h-20 rounded-2xl shadow-lg mb-3" />
            <h1 className="text-2xl font-bold text-emerald-950">حساب کتاب</h1>
            <p className="text-xs text-slate-500">محفوظ کلاؤڈ کھاتہ اور ڈیجیٹل لیجر</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-5 text-sm font-bold">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg transition ${authMode === 'login' ? 'bg-emerald-700 text-white shadow' : 'text-slate-600'}`}
            >
              لاگ ان کریں
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg transition ${authMode === 'signup' ? 'bg-emerald-700 text-white shadow' : 'text-slate-600'}`}
            >
              نیا اکاؤنٹ (سائن اپ)
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">آپ کا پورا نام / دکان کا نام</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثلاً: توقیر احمد"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ای میل ایڈریس (پاسورڈ ریکوری کے لیے)</label>
              <input
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>

            {authMode !== 'forgot' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">پاسورڈ (انٹری اور ایڈٹ کی حفاظت کے لیے)</label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              {authLoading
                ? 'انتظار کریں...'
                : authMode === 'login'
                ? 'محفوظ لاگ ان کریں'
                : authMode === 'signup'
                ? 'نیا اکاؤنٹ بنائیں'
                : 'ای میل پر ریکوری لنک بھیجیں'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
            {authMode === 'login' ? (
              <button type="button" onClick={() => setAuthMode('forgot')} className="text-emerald-700 font-bold underline">
                پاسورڈ بھول گئے؟ (Forgot Password)
              </button>
            ) : (
              <button type="button" onClick={() => setAuthMode('login')} className="text-emerald-700 font-bold underline">
                واپس لاگ ان پر جائیں
              </button>
            )}
            <button type="button" onClick={() => setShowCloudSetup(true)} className="text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" /> کلاؤڈ سیٹنگ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-3.5 rounded-2xl shadow-xl text-white text-sm font-bold text-center ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.text}
        </div>
      )}

      <header className="bg-emerald-900 text-white px-4 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src="./icon-192.png" alt="حساب کتاب" className="w-11 h-11 rounded-xl border-2 border-amber-400 shadow" />
            <div>
              <h1 className="text-xl font-bold leading-tight">حساب کتاب</h1>
              <p className="text-[11px] text-emerald-200 flex items-center gap-1">
                <Cloud className="w-3 h-3 text-amber-400" /> کلاؤڈ بیک اپ فعال ({user.email})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadUserData(user.id)}
              title="ڈیٹا ریفریش کریں"
              className="p-2 bg-emerald-800 rounded-xl hover:bg-emerald-700"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportBackup}
              title="بیک اپ فائل ڈاؤن لوڈ کریں"
              className="p-2 bg-emerald-800 rounded-xl hover:bg-emerald-700"
            >
              <Download className="w-4 h-4 text-amber-300" />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              title="لاگ آؤٹ"
              className="p-2 bg-red-900/70 rounded-xl hover:bg-red-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-emerald-800/80 rounded-2xl p-2.5 border border-emerald-700">
            <p className="text-[11px] text-emerald-200">کل لینے ہیں (ادھار)</p>
            <p className="text-base font-bold text-amber-300" dir="ltr">Rs {totals.totalGave.toLocaleString()}</p>
          </div>
          <div className="bg-emerald-800/80 rounded-2xl p-2.5 border border-emerald-700">
            <p className="text-[11px] text-emerald-200">کل وصول ہوئے</p>
            <p className="text-base font-bold text-emerald-300" dir="ltr">Rs {totals.totalGot.toLocaleString()}</p>
          </div>
          <div className="bg-white text-emerald-950 rounded-2xl p-2.5 shadow">
            <p className="text-[11px] text-slate-500 font-bold">صافی بیلنس</p>
            <p className="text-base font-bold" dir="ltr">Rs {totals.net.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-4">
        {!selectedCustomer ? (
          <>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="کھاتہ دار تلاش کریں..."
                  className="w-full bg-white border border-slate-200 rounded-2xl pr-9 pl-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                onClick={() => {
                  setQuickTab('customer');
                  setShowQuickModal(true);
                }}
                className="bg-emerald-800 text-white px-3.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <UserPlus className="w-4 h-4" /> نیا کھاتہ
              </button>
            </div>

            <div className="space-y-2.5">
              {filteredCustomers.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
                  <BookOpen className="w-12 h-12 text-emerald-700 mx-auto mb-2 opacity-70" />
                  <h3 className="font-bold text-slate-800">ابھی کوئی کھاتہ دار موجود نہیں</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    نیچے درمیان میں موجود (+) بٹن دبائیں اور نیا کھاتہ یا انٹری شامل کریں۔
                  </p>
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const bal = customerBalances[cust.id] || { net: 0 };
                  return (
                    <div
                      key={cust.id}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.99] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-lg">
                          {cust.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{cust.name}</h3>
                          <p className="text-xs text-slate-400" dir="ltr">{cust.phone || 'فون نمبر درج نہیں'}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className={`font-bold text-base ${bal.net > 0 ? 'text-red-600' : bal.net < 0 ? 'text-emerald-600' : 'text-slate-600'}`} dir="ltr">
                          Rs {Math.abs(bal.net).toLocaleString()}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {bal.net > 0 ? 'لینے ہیں' : bal.net < 0 ? 'ایڈوانس / دینے ہیں' : 'حساب برابر'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 flex items-center justify-between">
              <div>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="text-xs text-emerald-700 font-bold underline mb-1 block"
                >
                  ← تمام کھاتہ داروں کی فہرست
                </button>
                <h2 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h2>
                <p className="text-xs text-slate-500">
                  کل بیلنس: <strong dir="ltr">Rs {(customerBalances[selectedCustomer.id]?.net || 0).toLocaleString()}</strong>
                </p>
              </div>
              <button
                onClick={() => handleDeleteCustomer(selectedCustomer)}
                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                title="کھاتہ دار ڈیلیٹ کریں"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {selectedCustomerEntries.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-500">
                  اس کھاتے میں ابھی کوئی انٹری نہیں ہے۔ درمیان والا (+) بٹن دبا کر انٹری کریں۔
                </div>
              ) : (
                selectedCustomerEntries.map((ent) => (
                  <div key={ent.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {ent.type === 'gave' ? (
                          <span className="text-xs font-bold text-red-600 flex items-center gap-0.5">
                            <ArrowUpRight className="w-3.5 h-3.5" /> دیے (ادھار)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                            <ArrowDownLeft className="w-3.5 h-3.5" /> لیے (وصول)
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400" dir="ltr">
                          {new Date(ent.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-0.5">{ent.note || 'بغیر تفصیل'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-base ${ent.type === 'gave' ? 'text-red-600' : 'text-emerald-600'}`} dir="ltr">
                        Rs {Number(ent.amount).toLocaleString()}
                      </span>
                      <button
                        onClick={() => {
                          setEditingEntry(ent);
                          setEntryCustomerId(ent.customer_id);
                          setEntryType(ent.type);
                          setEntryAmount(String(ent.amount));
                          setEntryNote(ent.note || '');
                          setQuickTab('entry');
                          setShowQuickModal(true);
                        }}
                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(ent)}
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2.5 flex items-center justify-around shadow-2xl z-30">
        <button
          onClick={() => setSelectedCustomerId(null)}
          className="flex flex-col items-center text-xs font-bold text-emerald-800"
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          کھاتہ جات
        </button>

        <button
          onClick={() => {
            setEditingEntry(null);
            setEntryAmount('');
            setEntryNote('');
            if (selectedCustomerId) setEntryCustomerId(selectedCustomerId);
            else if (customers[0]) setEntryCustomerId(customers[0].id);
            setQuickTab(customers.length === 0 ? 'customer' : 'entry');
            setShowQuickModal(true);
          }}
          aria-label="نئی انٹری"
          className="-mt-9 w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white shadow-xl border-4 border-white flex items-center justify-center active:scale-95 transition"
        >
          <Plus className="w-9 h-9 stroke-[2.5]" />
        </button>

        <button
          onClick={handleExportBackup}
          className="flex flex-col items-center text-xs font-bold text-slate-600"
        >
          <ShieldCheck className="w-5 h-5 mb-0.5 text-emerald-700" />
          بیک اپ
        </button>
      </nav>

      {showQuickModal && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setQuickTab('entry')}
                  className={`px-3 py-1.5 rounded-lg ${quickTab === 'entry' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
                >
                  {editingEntry ? 'انٹری ایڈٹ کریں' : 'نئی رقم انٹری'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTab('customer')}
                  className={`px-3 py-1.5 rounded-lg ${quickTab === 'customer' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
                >
                  نیا کھاتہ دار
                </button>
              </div>
              <button onClick={() => setShowQuickModal(false)} className="p-1.5 bg-slate-100 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickTab === 'entry' ? (
              <form onSubmit={handleSaveEntry} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کھاتہ دار منتخب کریں</label>
                  <select
                    required
                    value={entryCustomerId}
                    onChange={(e) => setEntryCustomerId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">-- منتخب کریں --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType('gave')}
                    className={`py-2.5 rounded-xl font-bold text-xs border-2 ${entryType === 'gave' ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    دیے (ادھار / جمع)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('got')}
                    className={`py-2.5 rounded-xl font-bold text-xs border-2 ${entryType === 'got' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    لیے (وصول پائے)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم (روپے)</label>
                  <input
                    type="number"
                    dir="ltr"
                    required
                    min="1"
                    step="any"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تفصیل / نوٹ</label>
                  <input
                    type="text"
                    value={entryNote}
                    onChange={(e) => setEntryNote(e.target.value)}
                    placeholder="مثلاً: بل نمبر یا سامان کی تفصیل"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> پاسورڈ تصدیق کے ساتھ محفوظ کریں
                </button>
              </form>
            ) : (
              <form onSubmit={handleAddCustomer} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کھاتہ دار کا نام</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="مثلاً: محمد علی"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">موبائل نمبر (اختیاری)</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="03001234567"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" /> پاسورڈ تصدیق سے نیا کھاتہ بنائیں
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {verifyModal.open && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border-2 border-amber-400">
            <div className="flex items-center gap-2.5 text-amber-600 mb-2">
              <KeyRound className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">{verifyModal.title}</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">{verifyModal.description}</p>
            <form onSubmit={confirmVerification} className="space-y-3">
              <input
                type="password"
                dir="ltr"
                required
                autoFocus
                value={verifyPasswordInput}
                onChange={(e) => setVerifyPasswordInput(e.target.value)}
                placeholder="اپنا اکاؤنٹ پاسورڈ لکھیں"
                className="w-full border-2 border-slate-300 focus:border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyModal({ open: false, title: '', description: '', onSuccess: null })}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  منسوخ کریں
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow"
                >
                  {verifying ? 'تصدیق ہو رہی ہے...' : 'تصدیق کریں'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
