import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FilePlus2,
  Landmark,
  LockKeyhole,
  LogOut,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  User,
  Users,
  WalletCards,
} from 'lucide-react';
import './styles.css';

const sectors = [
  'ICT',
  'Manufacturing',
  'Finance & Insurance',
  'Hotels & Restaurants',
  'Oil & Gas',
  'Agriculture/Forestry',
  'Civil Construction',
  'Transport & Logistics',
  'Franchising',
  'Power & Energy',
  'Mining & Quarry',
  'Gaming',
  'Aviation',
];

const currencies = ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'ZAR'];

const contractTypes = ['New', 'Renewal', 'Extention', 'Additional fee'];
const contractTypesRequiringCertificate = ['Renewal', 'Extention', 'Additional fee'];

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const apiUrl = `${apiBaseUrl}/api/applications`;
const authUrl = `${apiBaseUrl}/api/auth`;
const paystackUrl = `${apiBaseUrl}/api/paystack`;

const subscriptionPlans = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 90000,
    cadence: 'per month',
    description: 'For clients actively managing a small portfolio.',
    features: ['Up to 5 applications', 'Expiry alerts', 'Remittance tracking'],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 1000000,
    cadence: 'per year',
    description: 'For recurring NOTAP compliance teams.',
    features: ['Unlimited applications', 'Priority alerts', 'Annual payment summary'],  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    cadence: 'custom billing',
    description: 'For groups with multiple subsidiaries and CREVA support.',
    features: ['Multiple client seats', 'CREVA onboarding', 'Custom reports'],
  },
];

const demoAdmin = {
  name: 'CREVA Admin',
  email: 'admin@creva.local',
  role: 'admin',
  plan: 'Enterprise',
};

const initialApplications = [
  {
    id: 1,
    title: 'Cloud Infrastructure License Transfer',
    contractType: 'New',
    certificateNumber: 'CR 24891',
    duration: 3,
    effectiveDate: '2024-07-01',
    approvedFee: 18500000,
    currency: 'NGN',
    transferor: 'NovaScale Systems Ltd',
    transferee: 'Crestline Telecoms Plc',
    sector: 'ICT',
    status: 'Approved',
    remittances: [
      { id: 1, type: 'Remittance', amount: 8500000, currency: 'NGN', exchangeRate: 1, convertedAmount: 8500000, date: '2024-09-13' },
      { id: 2, type: 'WHT', amount: 1850000, currency: 'NGN', exchangeRate: 1, convertedAmount: 1850000, date: '2024-09-13' },
      { id: 3, type: 'Remittance', amount: 5500000, currency: 'NGN', exchangeRate: 1, convertedAmount: 5500000, date: '2025-03-04' },
    ],
  },
  {
    id: 2,
    title: 'Hotel Operations Management Agreement',
    contractType: 'Renewal',
    certificateNumber: 'CR 20344',
    duration: 5,
    effectiveDate: '2021-06-15',
    approvedFee: 275000,
    currency: 'USD',
    transferor: 'HarborGate Hospitality Inc',
    transferee: 'Lagos Meridian Hotels Ltd',
    sector: 'Hotels & Restaurants',
    status: 'Approved',
    remittances: [
      { id: 1, type: 'Remittance', amount: 225000, currency: 'USD', exchangeRate: 1, convertedAmount: 225000, date: '2022-02-17' },
      { id: 2, type: 'WHT', amount: 50000, currency: 'USD', exchangeRate: 1, convertedAmount: 50000, date: '2022-02-17' },
    ],
  },
  {
    id: 3,
    title: 'Manufacturing Process Know-how Transfer',
    contractType: 'New',
    certificateNumber: 'CR 17806',
    duration: 2,
    effectiveDate: '2023-02-10',
    approvedFee: 42000000,
    currency: 'NGN',
    transferor: 'Kintaro Industrial Japan',
    transferee: 'Oakbelt Manufacturing Ltd',
    sector: 'Manufacturing',
    status: 'Approved',
    remittances: [{ id: 1, type: 'Remittance', amount: 22000000, currency: 'NGN', exchangeRate: 1, convertedAmount: 22000000, date: '2023-09-06' }],
  },
  {
    id: 4,
    title: 'Franchise Brand Support Agreement',
    contractType: 'Additional fee',
    certificateNumber: 'CR 30015',
    duration: 3,
    effectiveDate: '2026-02-01',
    approvedFee: 63000000,
    currency: 'NGN',
    transferor: 'BlueArc Franchise Global',
    transferee: 'Creekside Retail Services',
    sector: 'Franchising',
    status: 'Pending',
    remittances: [],
  },
];

const money = (amount, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(Number(amount || 0));

const formatCurrencyBalances = (balancesByCurrency = {}) => {
  const entries = Object.entries(balancesByCurrency).filter(([, amount]) => Number(amount) > 0);
  if (entries.length === 0) return money(0);
  return entries.map(([currency, amount]) => money(amount, currency)).join(' / ');
};

const numberOnly = (value) => value.replace(/[^\d.]/g, '');

const formatInputNumber = (value) => {
  const raw = numberOnly(String(value || ''));
  if (!raw) return '';
  const [whole, decimal] = raw.split('.');
  const formattedWhole = new Intl.NumberFormat('en-NG').format(Number(whole || 0));
  return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal.slice(0, 2)}`;
};

const convertedPaymentAmount = (amount, exchangeRate, paymentCurrency, approvedCurrency) => {
  const numericAmount = Number(amount || 0);
  const numericRate = Number(exchangeRate || 1);
  if (numericRate <= 0) return 0;
  if (paymentCurrency === approvedCurrency) return numericAmount;
  if (approvedCurrency === 'NGN') return numericAmount * numericRate;
  if (paymentCurrency === 'NGN') return numericAmount / numericRate;
  return numericAmount * numericRate;
};

const exchangeRatePlaceholder = (paymentCurrency, approvedCurrency) => {
  if (approvedCurrency === 'NGN') return `1 ${paymentCurrency} in NGN`;
  if (paymentCurrency === 'NGN') return `1 ${approvedCurrency} in NGN`;
  return `1 ${paymentCurrency} in ${approvedCurrency}`;
};

const exchangeFormulaText = (paymentType, paymentCurrency, approvedCurrency) => {
  if (paymentCurrency === approvedCurrency) {
    return `${paymentType} is already in ${approvedCurrency}, so it is subtracted directly from the approved fee.`;
  }
  if (approvedCurrency === 'NGN') {
    return `${paymentType} in ${paymentCurrency} is converted to NGN as amount * exchange rate. Balance is approved fee in NGN - converted remittance - WHT in NGN.`;
  }
  if (paymentCurrency === 'NGN') {
    return `${paymentType} in NGN is converted to ${approvedCurrency} as amount / exchange rate, then subtracted from the approved fee.`;
  }
  return `${paymentType} in ${paymentCurrency} is converted to ${approvedCurrency} as amount * exchange rate, then subtracted from the approved fee.`;
};

const addYears = (date, years) => {
  const next = new Date(`${date}T00:00:00`);
  next.setFullYear(next.getFullYear() + Number(years || 0));
  return next;
};

const daysBetween = (from, to) => Math.ceil((to - from) / (1000 * 60 * 60 * 24));

const maxDurationFor = (sector) => (['Hotels & Restaurants', 'Agriculture/Forestry'].includes(sector) ? 5 : 3);
const requiresReferenceCertificate = (contractType) => contractTypesRequiringCertificate.includes(contractType);

const blankForm = {
  contractType: 'New',
  title: '',
  extendingCertificateNumber: 'CR ',
  certificateNumber: 'CR ',
  duration: 1,
  effectiveDate: new Date().toISOString().slice(0, 10),
  approvedFee: '',
  currency: 'NGN',
  transferor: '',
  transferee: '',
  sector: 'ICT',
  status: 'Approved',
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('crevaAuthToken') || '');
  const [authMode, setAuthMode] = useState('register');
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [applications, setApplications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(blankForm);
  const [payment, setPayment] = useState({ type: 'Remittance', amount: '', currency: 'NGN', taxPercent: '', exchangeRate: '1', date: new Date().toISOString().slice(0, 10) });
  const [editingApplicationId, setEditingApplicationId] = useState(null);
  const [editingRemittanceId, setEditingRemittanceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [devToken, setDevToken] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadApplications();
    }
  }, [currentUser]);

  const authHeaders = (token = authToken) => (token ? { Authorization: `Bearer ${token}` } : {});
  const jsonHeaders = (token = authToken) => ({ 'Content-Type': 'application/json', ...authHeaders(token) });

  const restoreSession = async () => {
    if (!authToken) return;

    try {
      const response = await fetch(`${authUrl}/me`, { headers: authHeaders(authToken) });
      if (!response.ok) throw new Error('Stored session expired.');
      const data = await response.json();
      setCurrentUser(data.user);
      setPaymentComplete(data.user.subscriptionStatus === 'Active');
    } catch {
      localStorage.removeItem('crevaAuthToken');
      setAuthToken('');
    }
  };

  const loadApplications = async (token = authToken) => {
    setLoading(true);
    setApiError('');

    try {
      const response = await fetch(apiUrl, { headers: authHeaders(token) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load applications from PostgreSQL.');
      setApplications(data);
      setSelectedId((current) => (data.some((app) => app.id === current) ? current : data[0]?.id || null));
    } catch (error) {
      setApplications([]);
      setSelectedId(null);
      setApiError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const decorated = useMemo(
    () => applications.map((app) => ({ ...app, ...calculateApplication(app, applications) })),
    [applications],
  );

  const filtered = decorated.filter((app) =>
    `${app.title} ${app.certificateNumber} ${app.transferor} ${app.transferee} ${app.sector}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const selected = decorated.find((app) => app.id === selectedId) || decorated[0];
  const stats = useMemo(() => summarize(decorated), [decorated]);
  const subscribed = currentUser?.role === 'admin' || paymentComplete;
  const selectedPlanDetails = subscriptionPlans.find((plan) => plan.id === selectedPlan) || subscriptionPlans[0];

  const authenticateClient = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    setAuthNotice('');
    const formData = new FormData(event.currentTarget);
    const isReturning = authMode === 'login';

    try {
      if (authMode === 'verify') {
        const response = await fetch(`${authUrl}/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.get('email'), token: formData.get('token') }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Email verification failed.');
        setAuthNotice(data.message);
        setAuthMode('login');
        setDevToken('');
        return;
      }

      if (authMode === 'forgot') {
        const response = await fetch(`${authUrl}/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.get('email') }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Password reset request failed.');
        setPendingEmail(formData.get('email'));
        setDevToken(data.resetToken || '');
        setAuthNotice(data.resetToken ? 'Password reset token generated for this local prototype.' : data.message);
        setAuthMode('reset');
        return;
      }

      if (authMode === 'reset') {
        const response = await fetch(`${authUrl}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.get('email'), token: formData.get('token'), password: formData.get('password') }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Password reset failed.');
        setAuthNotice(data.message);
        setAuthMode('login');
        setDevToken('');
        return;
      }

      const payload = {
        company: formData.get('company'),
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        planId: selectedPlan,
        planName: selectedPlanDetails.name,
      };
      const response = await fetch(`${authUrl}/${isReturning ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed.');

      if (!isReturning) {
        setPendingEmail(data.email);
        setDevToken(data.verificationToken);
        setAuthNotice(data.message);
        setAuthMode('verify');
        return;
      }

      localStorage.setItem('crevaAuthToken', data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setPaymentComplete(data.user.subscriptionStatus === 'Active');
      await loadApplications(data.token);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const startSubscriptionPayment = async () => {
    setPaymentBusy(true);
    setPaymentError('');

    try {
      const response = await fetch(`${paystackUrl}/initialize`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ planId: selectedPlan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start Paystack payment.');
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setPaymentError(error.message);
      setPaymentBusy(false);
    }
  };

  const verifySubscriptionPayment = async (reference) => {
    setPaymentBusy(true);
    setPaymentError('');

    try {
      const response = await fetch(`${paystackUrl}/verify`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ reference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to verify Paystack payment.');
      setPaymentComplete(true);
      setCurrentUser((user) => user ? { ...user, subscriptionStatus: 'Active', plan: data.planId || user.plan } : user);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      setPaymentError(error.message);
    } finally {
      setPaymentBusy(false);
    }
  };

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (reference && authToken) {
      verifySubscriptionPayment(reference);
    }
  }, [authToken]);

  const loginAdmin = () => {
    setCurrentUser(demoAdmin);
    setPaymentComplete(true);
  };

  const logout = async () => {
    if (authToken) {
      await fetch(`${authUrl}/logout`, { method: 'POST', headers: authHeaders() }).catch(() => {});
    }
    localStorage.removeItem('crevaAuthToken');
    setAuthToken('');
    setCurrentUser(null);
    setPaymentComplete(false);
    setSelectedPlan('monthly');
    setAuthMode('login');
  };

  if (!currentUser) {
    return (
      <main>
        <section className="shell">
          <LoginScreen
            authMode={authMode}
            setAuthMode={setAuthMode}
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            selectedPlanDetails={selectedPlanDetails}
            onClientAuth={authenticateClient}
            onAdminLogin={loginAdmin}
            authError={authError}
            authNotice={authNotice}
            pendingEmail={pendingEmail}
            devToken={devToken}
            authBusy={authBusy}
          />
        </section>
      </main>
    );
  }

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'sector') {
        next.duration = Math.min(Number(next.duration), maxDurationFor(value));
      }
      if (key === 'certificateNumber') {
        const digits = value.replace(/\D/g, '');
        next.certificateNumber = `CR ${digits}`;
      }
      if (key === 'extendingCertificateNumber') {
        const digits = value.replace(/\D/g, '');
        next.extendingCertificateNumber = `CR ${digits}`;
      }
      if (!requiresReferenceCertificate(next.contractType)) {
        next.extendingCertificateNumber = 'CR ';
      }
      if (requiresReferenceCertificate(next.contractType) && next.extendingCertificateNumber) {
        const target = decorated.find((app) => app.certificateNumber === next.extendingCertificateNumber && app.id !== editingApplicationId);
        if (target) {
          next.title = target.title;
          next.status = target.status;
          next.sector = target.sector;
          next.duration = Math.min(Number(next.duration), maxDurationFor(target.sector));
          next.transferor = target.transferor;
          next.transferee = target.transferee;
          if (next.contractType === 'Extention') {
            next.approvedFee = String(target.balance);
            next.currency = target.currency;
          }
        }
      }
      if (key === 'approvedFee') {
        next.approvedFee = numberOnly(value);
      }
      if (key === 'duration') {
        next.duration = Math.min(Math.max(Number(value || 1), 1), maxDurationFor(current.sector));
      }
      return next;
    });
  };

  const startApplicationEdit = (app) => {
    setEditingApplicationId(app.id);
    setForm({
      contractType: app.contractType || 'New',
      title: app.title,
      extendingCertificateNumber: app.extendingCertificateNumber || 'CR ',
      certificateNumber: app.certificateNumber,
      duration: app.duration,
      effectiveDate: app.effectiveDate,
      approvedFee: String(app.approvedFee),
      currency: app.currency,
      transferor: app.transferor,
      transferee: app.transferee,
      sector: app.sector,
      status: app.status,
    });
  };

  const cancelApplicationEdit = () => {
    setEditingApplicationId(null);
    setForm(blankForm);
  };

  const addApplication = async (event) => {
    event.preventDefault();
    const duplicate = applications.some((app) => app.certificateNumber === form.certificateNumber && app.id !== editingApplicationId);
    const durationLimit = maxDurationFor(form.sector);
    const currentEditedApp = decorated.find((app) => app.id === editingApplicationId);
    const extensionTarget = decorated.find((app) => app.certificateNumber === form.extendingCertificateNumber && app.id !== editingApplicationId);

    if (
      duplicate
      || Number(form.duration) > durationLimit
      || !form.title
      || !form.transferor
      || !form.transferee
      || (requiresReferenceCertificate(form.contractType) && !extensionTarget)
      || (currentEditedApp && Number(form.approvedFee) < currentEditedApp.totalRemitted)
      || (currentEditedApp && currentEditedApp.remittances.length > 0 && form.currency !== currentEditedApp.currency)
    ) {
      return;
    }

    const app = {
      ...form,
      duration: Number(form.duration),
      approvedFee: Number(form.approvedFee),
      remittances: [],
    };

    try {
      const response = await fetch(editingApplicationId ? `${apiUrl}/${editingApplicationId}` : apiUrl, {
        method: editingApplicationId ? 'PUT' : 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(app),
      });
      if (!response.ok) throw new Error(editingApplicationId ? 'PostgreSQL rejected the application update.' : 'PostgreSQL rejected the new application.');
      const data = await response.json();
      setApplications(data);
      setSelectedId(editingApplicationId || data.find((item) => item.certificateNumber === app.certificateNumber)?.id || data[0]?.id || null);
      setEditingApplicationId(null);
      setForm(blankForm);
      setApiError('');
    } catch (error) {
      setApiError(error.message);
    }
  };

  const startRemittanceEdit = (item) => {
    setEditingRemittanceId(item.id);
    setPayment({
      type: item.type,
      amount: String(item.amount),
      currency: item.currency,
      taxPercent: String(item.taxPercent || ''),
      exchangeRate: String(item.exchangeRate || 1),
      date: item.date,
    });
  };

  const cancelRemittanceEdit = () => {
    setEditingRemittanceId(null);
    setPayment({ type: 'Remittance', amount: '', currency: selected?.currency || 'NGN', taxPercent: '', exchangeRate: '1', date: new Date().toISOString().slice(0, 10) });
  };

  const addPayment = async (event) => {
    event.preventDefault();
    if (!selected || Number(payment.amount) <= 0) return;

    const amount = Number(payment.amount);
    const taxPercent = Number(payment.taxPercent || 0);
    const shouldSplitTax = !editingRemittanceId && payment.type === 'Remittance' && taxPercent > 0;
    const whtAmount = shouldSplitTax ? amount * taxPercent / 100 : 0;
    const netRemittanceAmount = shouldSplitTax ? amount - whtAmount : amount;
    const convertedAmount = convertedPaymentAmount(amount, payment.exchangeRate, payment.currency, selected.currency);
    const originalRemittance = selected.remittances.find((item) => item.id === editingRemittanceId);
    const originalConvertedAmount = originalRemittance
      ? convertedPaymentAmount(originalRemittance.amount, originalRemittance.exchangeRate, originalRemittance.currency, selected.currency)
      : 0;
    if (selected.totalRemitted - originalConvertedAmount + convertedAmount > selected.approvedFee) return;

    try {
      const response = await fetch(editingRemittanceId ? `${apiUrl}/${selected.id}/remittances/${editingRemittanceId}` : `${apiUrl}/${selected.id}/remittances`, {
        method: editingRemittanceId ? 'PUT' : 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ ...payment, amount: netRemittanceAmount, taxPercent, exchangeRate: Number(payment.exchangeRate || 1) }),
      });
      if (!response.ok) throw new Error('PostgreSQL rejected this remittance/WHT because it failed validation.');
      let data = await response.json();
      if (shouldSplitTax && whtAmount > 0) {
        const whtResponse = await fetch(`${apiUrl}/${selected.id}/remittances`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ ...payment, type: 'WHT', amount: whtAmount, taxPercent, exchangeRate: Number(payment.exchangeRate || 1) }),
        });
        if (!whtResponse.ok) throw new Error('PostgreSQL rejected the calculated WHT tranche.');
        data = await whtResponse.json();
      }
      setApplications(data);
      setSelectedId(selected.id);
      setEditingRemittanceId(null);
      setPayment((current) => ({ ...current, amount: '', taxPercent: '', exchangeRate: current.currency === selected.currency ? '1' : current.exchangeRate }));
      setApiError('');
    } catch (error) {
      setApiError(error.message);
    }
  };

  const paymentConvertedAmount = convertedPaymentAmount(payment.amount, payment.exchangeRate, payment.currency, selected?.currency);
  const paymentTaxPercent = Number(payment.taxPercent || 0);
  const paymentWhtAmount = payment.type === 'Remittance' && !editingRemittanceId && paymentTaxPercent > 0
    ? Number(payment.amount || 0) * paymentTaxPercent / 100
    : 0;
  const paymentNetRemittanceAmount = paymentWhtAmount > 0 ? Number(payment.amount || 0) - paymentWhtAmount : Number(payment.amount || 0);
  const needsExchangeRate = selected && payment.currency !== selected.currency;
  const editingOriginalRemittance = selected?.remittances.find((item) => item.id === editingRemittanceId);
  const editingOriginalConvertedAmount = editingOriginalRemittance
    ? convertedPaymentAmount(editingOriginalRemittance.amount, editingOriginalRemittance.exchangeRate, editingOriginalRemittance.currency, selected.currency)
    : 0;
  const paymentWouldExceed = selected && selected.totalRemitted - editingOriginalConvertedAmount + paymentConvertedAmount > selected.approvedFee;
  const selectedExpired = selected && selected.daysToExpiry < 0;
  const durationLimit = maxDurationFor(form.sector);
  const duplicateCertificate = applications.some((app) => app.certificateNumber === form.certificateNumber && app.id !== editingApplicationId);
  const extensionTarget = decorated.find((app) => app.certificateNumber === form.extendingCertificateNumber && app.id !== editingApplicationId);
  const extensionCertificateMissing = requiresReferenceCertificate(form.contractType) && !extensionTarget;
  const editedAppWouldBeBelowRemitted = editingApplicationId && selected && Number(form.approvedFee) < selected.totalRemitted;
  const editedAppCurrencyChangeWithRemittances = editingApplicationId && selected && selected.remittances.length > 0 && form.currency !== selected.currency;

  return (
    <main>
      <section className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark"><Landmark size={24} /></div>
            <div>
              <p>{currentUser.role === 'admin' ? 'CREVA ADMIN' : currentUser.company || 'CREVA'}</p>
              <h1>Notap Client Desk</h1>
            </div>
          </div>
          <div className="top-actions">
            <span className="user-chip"><User size={16} /> {currentUser.name}</span>
            <button className={subscribed ? 'subscribed' : ''} onClick={() => currentUser.role === 'client' && setPaymentComplete((value) => !value)}>
              {subscribed ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}
              {subscribed ? currentUser.plan : 'Subscribe'}
            </button>
            <button className="ghost-button" onClick={logout}><LogOut size={18} /> Logout</button>
          </div>
        </header>

        {currentUser.role === 'admin' && <AdminDashboard applications={decorated} stats={stats} />}

        {currentUser.role === 'client' && !subscribed && (
        <SubscriptionScreen
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          selectedPlanDetails={selectedPlanDetails}
          onPay={startSubscriptionPayment}
          paymentBusy={paymentBusy}
          paymentError={paymentError}
        />
      )}

        {apiError && (
          <div className="db-banner">
            <AlertTriangle size={18} />
            <span>{apiError}</span>
          </div>
        )}

        <section className={subscribed ? 'workspace' : 'workspace locked'}>
          <aside className="sidebar">
            <div className="search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applications" />
            </div>

            <div className="stat-grid">
              <Metric label="Applications" value={stats.total} icon={<FilePlus2 />} />
              <Metric label="Approved" value={stats.approved} icon={<BadgeCheck />} />
              <Metric label="Expiring" value={stats.expiring} icon={<CalendarClock />} />
              <Metric label="Balance" value={formatCurrencyBalances(stats.balancesByCurrency)} icon={<WalletCards />} />
            </div>

            <div className="application-list">
              {loading && <p className="empty">Loading applications from PostgreSQL...</p>}
              {filtered.map((app) => (
                <button key={app.id} className={app.id === selected?.id ? 'application active' : 'application'} onClick={() => setSelectedId(app.id)}>
                  <span>
                    <strong>{app.title}</strong>
                    <small>{app.contractType || 'New'} · {app.certificateNumber} · {app.sector}</small>
                  </span>
                  <i className={app.alert.tone}>{app.alert.label}</i>
                </button>
              ))}
            </div>
          </aside>

          <section className="content">
            {selected && (
              <>
                <div className="detail-header">
                  <div>
                    <p>{selected.status} · {selected.certificateNumber}</p>
                    <h2>{selected.title}</h2>
                  </div>
                  <div className="detail-actions">
                    <button className="secondary-button" onClick={() => startApplicationEdit(selected)}><FilePlus2 size={16} /> Edit application</button>
                    <span className={`status ${selected.alert.tone}`}><Bell size={16} /> {selected.alert.label}</span>
                  </div>
                </div>

                <div className="alert-strip">
                  <AlertTriangle size={20} />
                  <p>{selected.alert.message}</p>
                </div>

                <div className="detail-grid">
                  <Info label="Transferor" value={selected.transferor} />
                  <Info label="Transferee" value={selected.transferee} />
                  <Info label="Effective date" value={formatDate(selected.effectiveDate)} />
                  <Info label="Expiry date" value={formatDate(selected.expiryDate)} />
                  <Info label="Approved fee" value={money(selected.approvedFee, selected.currency)} />
                  <Info label="Balance fee" value={money(selected.balance, selected.currency)} />
                  {requiresReferenceCertificate(selected.contractType) && <Info label={selected.contractType === 'Renewal' ? 'Certificate renewed' : selected.contractType === 'Additional fee' ? 'Additional invoice certificate' : 'Certificate extended'} value={selected.extendingCertificateNumber || 'Not set'} />}
                </div>

                <div className="progress-wrap">
                  <div>
                    <strong>{money(selected.totalRemitted, selected.currency)}</strong>
                    <span> of {money(selected.approvedFee, selected.currency)} remitted</span>
                  </div>
                  <div className="progress"><span style={{ width: `${selected.percentPaid}%` }} /></div>
                </div>

                <section className="split">
                  <form className="panel" onSubmit={addPayment}>
                    <h3><CircleDollarSign size={18} /> {editingRemittanceId ? 'Edit remittance or WHT' : 'Add remittance or WHT'}</h3>
                    <div className="fields three">
                      <label>
                        Type
                        <select value={payment.type} onChange={(event) => setPayment({ ...payment, type: event.target.value, taxPercent: event.target.value === 'WHT' ? '' : payment.taxPercent })}>
                          <option>Remittance</option>
                          <option>WHT</option>
                        </select>
                      </label>
                      <label>
                        Currency
                        <select value={payment.currency} onChange={(event) => setPayment({ ...payment, currency: event.target.value, exchangeRate: event.target.value === selected.currency ? '1' : payment.exchangeRate })}>
                          {currencies.map((currency) => <option key={currency}>{currency}</option>)}
                        </select>
                      </label>
                      <label>
                        Date
                        <input type="date" value={payment.date} onChange={(event) => setPayment({ ...payment, date: event.target.value })} />
                      </label>
                    </div>
                    <label>
                      {payment.type === 'Remittance' && paymentTaxPercent > 0 ? 'Gross remittance amount' : 'Amount'}
                      <input inputMode="decimal" value={formatInputNumber(payment.amount)} onChange={(event) => setPayment({ ...payment, amount: numberOnly(event.target.value) })} placeholder="0.00" />
                    </label>
                    <label>
                      Tax %
                      <input inputMode="decimal" value={formatInputNumber(payment.taxPercent)} onChange={(event) => setPayment({ ...payment, taxPercent: numberOnly(event.target.value) })} placeholder="0" disabled={editingRemittanceId || payment.type === 'WHT'} />
                    </label>
                    {needsExchangeRate && (
                      <label>
                        Exchange rate
                        <input inputMode="decimal" value={formatInputNumber(payment.exchangeRate)} onChange={(event) => setPayment({ ...payment, exchangeRate: numberOnly(event.target.value) })} placeholder={exchangeRatePlaceholder(payment.currency, selected.currency)} />
                      </label>
                    )}
                    <p className="helper">{exchangeFormulaText(payment.type, payment.currency, selected.currency)}</p>
                    {paymentWhtAmount > 0 && (
                      <p className="helper">Calculated WHT: {money(paymentWhtAmount, payment.currency)}. Net remittance: {money(paymentNetRemittanceAmount, payment.currency)}.</p>
                    )}
                    {selectedExpired && <p className="error">This certificate has expired. Remittance and WHT cannot be added or edited.</p>}
                    {payment.amount && <p className={paymentWouldExceed ? 'error' : 'helper'}>{paymentWouldExceed ? 'This would exceed the approved fee. Negative balance is not allowed.' : `${money(payment.amount, payment.currency)} equals ${money(paymentConvertedAmount, selected.currency)}. New balance: ${money(selected.approvedFee - selected.totalRemitted + editingOriginalConvertedAmount - paymentConvertedAmount, selected.currency)}`}</p>}
                    <div className="form-actions">
                      {editingRemittanceId && <button type="button" className="secondary-button" onClick={cancelRemittanceEdit}>Cancel</button>}
                      <button disabled={selectedExpired || paymentWouldExceed || !payment.amount || (needsExchangeRate && !Number(payment.exchangeRate))}>{editingRemittanceId ? <Check size={17} /> : <Plus size={17} />} {editingRemittanceId ? 'Update tranche' : 'Add tranche'}</button>
                    </div>
                  </form>

                  <div className="panel">
                    <h3><WalletCards size={18} /> Payment tranches</h3>
                    <div className="tranches">
                      {selected.remittances.length === 0 && <p className="empty">No remittances recorded yet.</p>}
                      {selected.remittances.map((item) => (
                        <div key={item.id} className="tranche">
                          <span>{item.type}<small>{formatDate(item.date)}</small></span>
                          <strong>
                            {money(item.amount, item.currency)}
                            {item.currency !== selected.currency && (
                              <small>@ {formatInputNumber(item.exchangeRate)} = {money(convertedPaymentAmount(item.amount, item.exchangeRate, item.currency, selected.currency), selected.currency)}</small>
                            )}
                            {Number(item.taxPercent || 0) > 0 && (
                              <small>Tax: {formatInputNumber(item.taxPercent)}%</small>
                            )}
                          </strong>
                          <button className="secondary-button" disabled={selectedExpired} onClick={() => startRemittanceEdit(item)}>Edit</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>

          <aside className="create-panel">
            <form className="panel" onSubmit={addApplication}>
              <h3><FilePlus2 size={18} /> {editingApplicationId ? 'Edit application' : 'New application'}</h3>
              <label>
                ContractType
                <select value={form.contractType} onChange={(event) => updateForm('contractType', event.target.value)}>
                  {contractTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label>
                Title
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Application title" required />
              </label>
              {requiresReferenceCertificate(form.contractType) && (
                <>
                  <label>
                    {form.contractType === 'Renewal' ? 'Certificate number being renewed' : form.contractType === 'Additional fee' ? 'Certificate number for additional invoice' : 'Certificate number being extended'}
                    <input value={form.extendingCertificateNumber} onChange={(event) => updateForm('extendingCertificateNumber', event.target.value)} placeholder="CR 00000" required />
                  </label>
                  {extensionTarget ? (
                    <p className="helper">{form.contractType === 'Extention' ? `Approved fee is set to the balance on ${extensionTarget.certificateNumber}: ${money(extensionTarget.balance, extensionTarget.currency)}.` : `Application details copied from ${extensionTarget.certificateNumber}.`}</p>
                  ) : (
                    <p className="error">Enter an existing certificate number for this client.</p>
                  )}
                </>
              )}
              <div className="fields two">
                <label>
                  Certificate no.
                  <input value={form.certificateNumber} onChange={(event) => updateForm('certificateNumber', event.target.value)} placeholder="CR 00000" required />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                    <option>Pending</option>
                    <option>Approved</option>
                  </select>
                </label>
              </div>
              {duplicateCertificate && <p className="error">Certificate number must be unique.</p>}
              {editedAppWouldBeBelowRemitted && <p className="error">Approved fee cannot be lower than the amount already remitted.</p>}
              {editedAppCurrencyChangeWithRemittances && <p className="error">Approved fee currency cannot be changed after remittances or WHT have been recorded.</p>}
              <div className="fields two">
                <label>
                  Sector
                  <span className="select-wrap">
                    <select value={form.sector} onChange={(event) => updateForm('sector', event.target.value)}>
                      {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                <label>
                  Duration
                  <input type="number" min="1" max={durationLimit} value={form.duration} onChange={(event) => updateForm('duration', event.target.value)} required />
                </label>
              </div>
              <p className="helper">Maximum duration for {form.sector} is {durationLimit} years.</p>
              <label>
                Effective date
                <input type="date" value={form.effectiveDate} onChange={(event) => updateForm('effectiveDate', event.target.value)} required />
              </label>
              <div className="fields two">
                <label>
                  Currency
                  <select value={form.currency} onChange={(event) => updateForm('currency', event.target.value)} disabled={form.contractType === 'Extention'}>
                    {currencies.map((currency) => <option key={currency}>{currency}</option>)}
                  </select>
                </label>
                <label>
                  Approved fee
                  <input inputMode="decimal" value={formatInputNumber(form.approvedFee)} onChange={(event) => updateForm('approvedFee', event.target.value)} placeholder="0.00" required readOnly={form.contractType === 'Extention'} />
                </label>
              </div>
              <label>
                Transferor
                <input value={form.transferor} onChange={(event) => updateForm('transferor', event.target.value)} placeholder="Name of transferor" required />
              </label>
              <label>
                Transferee
                <input value={form.transferee} onChange={(event) => updateForm('transferee', event.target.value)} placeholder="Name of transferee" required />
              </label>
              <div className="form-actions">
                {editingApplicationId && <button type="button" className="secondary-button" onClick={cancelApplicationEdit}>Cancel</button>}
                <button disabled={duplicateCertificate || extensionCertificateMissing || editedAppWouldBeBelowRemitted || editedAppCurrencyChangeWithRemittances || Number(form.duration) > durationLimit}>{editingApplicationId ? <Check size={17} /> : <Plus size={17} />} {editingApplicationId ? 'Update application' : 'Save application'}</button>
              </div>
            </form>
          </aside>
        </section>
      </section>
    </main>
  );
}

function calculateApplication(app, allApplications = []) {
  const today = new Date();
  const expiryDateObject = addYears(app.effectiveDate, app.duration);
  const daysToExpiry = daysBetween(today, expiryDateObject);
  const totalRemitted = app.remittances.reduce(
    (sum, item) => sum + convertedPaymentAmount(item.amount, item.exchangeRate, item.currency, app.currency),
    0,
  );
  const balance = Math.max(app.approvedFee - totalRemitted, 0);
  const expired = daysToExpiry < 0;
  const fullyPaid = balance === 0;

  let alert = {
    label: 'Active',
    tone: 'good',
    message: 'Application is valid and still has no immediate action due.',
  };

  if (daysToExpiry <= 30 && daysToExpiry >= 0) {
    alert = {
      label: 'Expiring',
      tone: 'warn',
      message: `${app.title} expires soon. Balance fee is ${money(balance, app.currency)}. Transferor: ${app.transferor}.`,
    };
  } else if (expired && fullyPaid) {
    alert = {
      label: 'Renewal due',
      tone: 'danger',
      message: 'Application has expired with no balance fee left. Apply for renewal of the application.',
    };
  } else if (!expired && fullyPaid && app.status === 'Approved') {
    alert = {
      label: 'Invoice option',
      tone: 'good',
      message: 'Application is active and all approved fees have been remitted. Apply for additional invoice, if any.',
    };
  } else if (expired && !fullyPaid) {
    alert = {
      label: 'Extension due',
      tone: 'danger',
      message: 'Application has expired with outstanding approved fee. Apply for extension of certificate of registration to remit all approved fee.',
    };
  }

  const followUpApplication = allApplications.find(
    (candidate) => candidate.extendingCertificateNumber === app.certificateNumber,
  );

  if (followUpApplication?.contractType === 'Renewal') {
    alert = {
      label: 'Renewed',
      tone: 'good',
      message: `Renewed. New certificate no: ${followUpApplication.certificateNumber}.`,
    };
  } else if (followUpApplication?.contractType === 'Extention') {
    alert = {
      label: 'Extended',
      tone: 'good',
      message: `Extended. New certificate no: ${followUpApplication.certificateNumber}.`,
    };
  } else if (followUpApplication?.contractType === 'Additional fee') {
    alert = {
      label: 'Invoice approved',
      tone: 'good',
      message: `Invoice approved. New certificate no: ${followUpApplication.certificateNumber}.`,
    };
  }

  return {
    expiryDate: expiryDateObject.toISOString().slice(0, 10),
    daysToExpiry,
    totalRemitted,
    balance,
    percentPaid: Math.min(100, Math.round((totalRemitted / app.approvedFee) * 100)),
    alert,
  };
}

function summarize(apps) {
  const summary = apps.reduce(
    (sum, app) => {
      sum.total += 1;
      sum.approved += app.status === 'Approved' ? 1 : 0;
      sum.expiring += app.daysToExpiry <= 30 && app.daysToExpiry >= 0 ? 1 : 0;
      sum.balancesByCurrency[app.currency] = (sum.balancesByCurrency[app.currency] || 0) + app.balance;
      return sum;
    },
    { total: 0, approved: 0, expiring: 0, balancesByCurrency: {} },
  );

  apps
    .filter((app) => app.contractType === 'Extention' && app.extendingCertificateNumber)
    .forEach((extension) => {
      const referenced = apps.find((app) => app.certificateNumber === extension.extendingCertificateNumber);
      if (!referenced) return;

      summary.balancesByCurrency[referenced.currency] = Math.max(
        0,
        (summary.balancesByCurrency[referenced.currency] || 0) - referenced.balance,
      );
    });

  return summary;
}

function LoginScreen({ authMode, setAuthMode, selectedPlan, setSelectedPlan, selectedPlanDetails, onClientAuth, onAdminLogin, authError, authNotice, pendingEmail, devToken, authBusy }) {
  const isRegistering = authMode === 'register';
  const isLogin = authMode === 'login';
  const isVerify = authMode === 'verify';
  const isForgot = authMode === 'forgot';
  const isReset = authMode === 'reset';

  return (
    <section className="auth-layout">
      <div className="auth-stack">
      <div className="login-card">
        <div className="auth-brand">
          <div className="brand-mark"><Landmark size={24} /></div>
          <div>
            <p>CREVA</p>
            <h1>Notap Client Desk</h1>
          </div>
        </div>
        <div className="login-tabs">
          <button type="button" className={isRegistering ? 'active' : ''} onClick={() => setAuthMode('register')}><User size={17} /> Register</button>
          <button type="button" className={isLogin ? 'active' : ''} onClick={() => setAuthMode('login')}><LockKeyhole size={17} /> Login</button>
          <button type="button" onClick={onAdminLogin}><Building2 size={17} /> Admin demo</button>
        </div>
        <form onSubmit={onClientAuth}>
          {isRegistering && (
            <>
              <label>
                Company name
                <input name="company" placeholder="Company registered with CREVA" required />
              </label>
              <label>
                Contact name
                <input name="name" placeholder="Primary contact" required />
              </label>
            </>
          )}
          <label>
            Email address
            <input name="email" type="email" defaultValue={(isVerify || isReset) ? pendingEmail : ''} placeholder="name@company.com" required />
          </label>
          {(isRegistering || isLogin || isReset) && (
            <label>
              {isReset ? 'New password' : 'Password'}
              <input name="password" type="password" placeholder={isReset ? 'Enter new password' : 'Enter password'} required />
            </label>
          )}
          {(isVerify || isReset) && (
            <label>
              {isVerify ? 'Email verification token' : 'Password reset token'}
              <input name="token" defaultValue={devToken} placeholder="Paste token" required />
            </label>
          )}
          {isRegistering && (
            <>
              <PlanPicker selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />
              <div className="checkout-summary">
                <span>Selected plan</span>
                <strong>{selectedPlanDetails.name} · {selectedPlanDetails.price ? money(selectedPlanDetails.price) : 'Contact CREVA'}</strong>
              </div>
            </>
          )}
          {isLogin && (
            <button type="button" className="text-button" onClick={() => setAuthMode('forgot')}>Forgot password?</button>
          )}
          {(isForgot || isReset || isVerify) && (
            <button type="button" className="text-button" onClick={() => setAuthMode('login')}>Back to login</button>
          )}
          {authNotice && <p className="helper">{authNotice}</p>}
          {devToken && <p className="token-box">{devToken}</p>}
          {authError && <p className="error">{authError}</p>}
          <button disabled={authBusy}>
            {isRegistering ? <User size={18} /> : <LockKeyhole size={18} />}
            {authBusy ? 'Please wait...' : isRegistering ? 'Create account' : isVerify ? 'Verify email' : isForgot ? 'Send reset token' : isReset ? 'Reset password' : 'Login'}
          </button>
        </form>
      </div>
      <div className="auth-stats">
        <Metric label="Client plans" value="3" icon={<CreditCard />} />
        <Metric label="Admin view" value="CREVA" icon={<Building2 />} />
        <Metric label="Alerts" value="Live" icon={<Bell />} />
      </div>
      </div>
    </section>
  );
}

function SubscriptionScreen({ selectedPlan, setSelectedPlan, selectedPlanDetails, onPay, paymentBusy, paymentError }) {
  const isEnterprise = selectedPlanDetails.id === 'enterprise';

  return (
    <section className="subscription-panel subscription-flow">
      <div>
        <span><CreditCard size={18} /> Subscription required</span>
        <h2>Choose a subscription to unlock NOTAP application management.</h2>
        <p>Monthly, yearly, and enterprise plans support client access, alerts, payment records, and CREVA assistance.</p>
        <PlanPicker selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} />
      </div>
      <div className="payment-card">
        <h3><Receipt size={18} /> Payment</h3>
        <div className="checkout-summary">
          <span>{selectedPlanDetails.name}</span>
          <strong>{selectedPlanDetails.price ? money(selectedPlanDetails.price) : 'Custom quote'}</strong>
          <small>{selectedPlanDetails.cadence}</small>
        </div>
        <p className="helper">
          {isEnterprise
            ? 'Enterprise subscriptions are activated by CREVA after custom billing.'
            : 'You will be redirected to Paystack to complete payment securely.'}
        </p>
        {paymentError && <p className="error">{paymentError}</p>}
        <button onClick={onPay} disabled={paymentBusy || isEnterprise}>
          <Check size={18} />
          {paymentBusy ? 'Opening Paystack...' : isEnterprise ? 'Contact CREVA billing' : 'Pay with Paystack'}
        </button>
      </div>
    </section>
  );
}

function PlanPicker({ selectedPlan, setSelectedPlan }) {
  return (
    <div className="plan-grid">
      {subscriptionPlans.map((plan) => (
        <button
          type="button"
          key={plan.id}
          className={selectedPlan === plan.id ? 'plan active' : 'plan'}
          onClick={() => setSelectedPlan(plan.id)}
        >
          <span>{plan.name}</span>
          <strong>{plan.price ? money(plan.price) : 'Custom'}</strong>
          <small>{plan.cadence}</small>
          <p>{plan.description}</p>
        </button>
      ))}
    </div>
  );
}

function AdminDashboard({ applications, stats }) {
  const activeSubscriptions = 18;
  const monthlyRevenue = 742000;
  const sectorCounts = applications.reduce((acc, app) => {
    acc[app.sector] = (acc[app.sector] || 0) + 1;
    return acc;
  }, {});
  const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <section className="admin-dashboard">
      <div className="admin-header">
        <div>
          <p>CREVA control room</p>
          <h2>Admin dashboard</h2>
        </div>
        <span><ShieldCheck size={17} /> Staff access</span>
      </div>
      <div className="admin-metrics">
        <Metric label="Clients" value="24" icon={<Users />} />
        <Metric label="Subscriptions" value={activeSubscriptions} icon={<CreditCard />} />
        <Metric label="Monthly revenue" value={money(monthlyRevenue)} icon={<CircleDollarSign />} />
        <Metric label="Open applications" value={stats.total} icon={<FilePlus2 />} />
      </div>
      <div className="admin-grid">
        <div className="panel">
          <h3><Building2 size={18} /> Client subscription activity</h3>
          {['Crestline Telecoms Plc', 'Lagos Meridian Hotels Ltd', 'Oakbelt Manufacturing Ltd'].map((client, index) => (
            <div className="admin-row" key={client}>
              <span>{client}<small>{index === 0 ? 'Yearly plan' : index === 1 ? 'Enterprise plan' : 'Monthly plan'}</small></span>
              <strong>{index === 2 ? 'Payment due' : 'Active'}</strong>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3><BadgeCheck size={18} /> Sector overview</h3>
          {topSectors.map(([sector, count]) => (
            <div className="admin-row" key={sector}>
              <span>{sector}<small>Tracked applications</small></span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3><Bell size={18} /> CREVA action queue</h3>
          <div className="admin-row"><span>Expiring certificates<small>Within 30 days</small></span><strong>{stats.expiring}</strong></div>
          <div className="admin-row"><span>Outstanding balances<small>Across all clients</small></span><strong>{formatCurrencyBalances(stats.balancesByCurrency)}</strong></div>
          <div className="admin-row"><span>Pending approvals<small>Client-entered records</small></span><strong>{applications.filter((app) => app.status === 'Pending').length}</strong></div>
        </div>
      </div>
    </section>
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00`));
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      {React.cloneElement(icon, { size: 18 })}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
