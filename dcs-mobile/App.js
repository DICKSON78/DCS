import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { dcsRequest } from './src/api.js';

/* ===== DCS brand palette (matches the ops admin / website) ===== */
const BG = '#050505';
const PANEL = '#101010';
const CARD = '#101010';
const LINE = '#232323';
const INK = '#f2f5f9';
const MUTED = '#93a3b8';
const FAINT = '#6b7484';
const GOLD = '#FFB900';
const GOLD2 = '#FFC533';
const GOLDSOF = 'rgba(255,185,0,0.12)';
const GOLDBN = 'rgba(255,185,0,0.30)';
const BLACK = '#000';
const SKY = '#38bdf8';
const BLUE = '#3b82f6';
const OK = '#A5F3A3';
const OKSOF = 'rgba(165,243,163,0.08)';
const OKBN = 'rgba(165,243,163,0.25)';
const DANGER = '#FFB4B4';
const DANGERSOF = 'rgba(255,180,180,0.08)';
const DANGERBN = 'rgba(255,180,180,0.25)';

const T = (w) => ({ fontFamily: w === 700 ? 'Poppins_700Bold' : w === 600 ? 'Poppins_600SemiBold' : w === 500 ? 'Poppins_500Medium' : 'Poppins_400Regular' });

const CARD_STYLE = { backgroundColor: CARD, borderRadius: 16, borderColor: LINE, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 };

const nf = (n) => 'TZS ' + Math.round(Number(n) || 0).toLocaleString('en-TZ');
const fmtTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const initials = (name) =>
  String(name || '?').split(/\s+/).slice(0, 2).map((w) => (w[0] || '')).join('').toUpperCase();
const freshRef = () => 'SIM-' + Math.floor(Date.now() / 1000) + '-' + Math.floor(Math.random() * 900 + 100);
const phoneDisplay = (p) => '+' + (String(p).replace(/\D/g, ''));
const maskPhone = (p) => {
  const s = String(p).replace(/\D/g, '');
  return s.length > 7 ? s.slice(0, 3) + ' ••• ' + s.slice(-4) : s;
};

function clientStatus(d, hold) {
  if (d === 'block') return { label: 'Imekataliwa', icon: 'times-circle', color: DANGER, soft: DANGERSOF, bn: DANGERBN };
  if (d === 'hold' && hold && hold !== 'released') return { label: 'Inakaguliwa', icon: 'clock', color: GOLD2, soft: GOLDSOF, bn: GOLDBN };
  return { label: 'Imekamilika', icon: 'check-circle', color: OK, soft: OKSOF, bn: OKBN };
}

const KEY = 'dcs_session_v1';

export default function App() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });

  const [session, setSession] = useState(null);
  const [booted, setBooted] = useState(false);
  const [dir, setDir] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('home');
  const [route, setRoute] = useState({ page: 'index' });
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const account = session?.account;
  const recipientName = (ref) => dir?.recipients?.find((r) => r.external_ref === ref)?.registered_name || null;

  const loadDirectory = async (phone) => {
    const res = await dcsRequest({ method: 'GET', path: '/v1/client/directory' });
    if (res.status === 200 && Array.isArray(res.body?.senders)) {
      const self = res.body.senders.find((s) => s.external_ref === phone) || null;
      if (!self) { setSession(null); await AsyncStorage.removeItem(KEY); return false; }
      return true;
    }
    setError('API haijibu — hakikisha API ya DCS imeanza (' + (res.status || 'network') + ')');
    return false;
  };

  const loadHistory = async (ref) => {
    if (!ref) return;
    setLoadingHist(true);
    try {
      const res = await dcsRequest({ method: 'GET', path: '/v1/transactions?user_external_ref=' + encodeURIComponent(ref) + '&limit=50' });
      if (res.status === 200) setHistory(res.body.transactions || []);
    } catch { setHistory([]); }
    finally { setLoadingHist(false); }
  };

  const restore = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const ok = await loadDirectory(saved.phone);
        if (ok) { setSession(saved); loadHistory(saved.phone); }
      }
    } catch { /* bad session */ }
    finally { setBooted(true); }
  };

  const handleLogin = async (sess) => {
    setSession(sess);
    await AsyncStorage.setItem(KEY, JSON.stringify(sess));
    setTab('home');
    setRoute({ page: 'index' });
    if (sess?.phone) { await loadDirectory(sess.phone); loadHistory(sess.phone); }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(KEY);
    setSession(null); setDir(null); setHistory([]); setError(null);
    setTab('home'); setRoute({ page: 'index' });
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await loadDirectory(session?.phone);
    await loadHistory(session?.phone);
    setRefreshing(false);
  };

  useEffect(() => { restore(); }, []);
  useEffect(() => { if (tab === 'home' && session) loadDirectory(session.phone); }, [tab]);

  const startSend = () => {
    const acc = session?.account;
    const phone = session?.phone;
    setDraft({
      sender: phone, recipient: '', customRecipient: false,
      amount: acc?.typical_amount || 100000,
      device: acc?.known_devices?.[0] || phone + '-dev',
      ref: freshRef(),
    });
    setRoute({ page: 'create', step: 'recipient' });
  };

  if (!fontsLoaded || !booted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <Mark size={66} />
        <Text style={[T(700), { color: INK, fontSize: 18 }]}>DCS Wallet</Text>
        <ActivityIndicator color={GOLD} />
      </SafeAreaView>
    );
  }

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const showFlow = route.page !== 'index';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      {!showFlow && (
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BG }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Mark size={34} rounded />
            <View>
              <Text style={[T(700), { color: INK, fontSize: 15.5, lineHeight: 19 }]}>DCS Wallet</Text>
              <Text style={[T(400), { color: MUTED, fontSize: 9, letterSpacing: 1.2 }]}>BENKI YA KIDIGITALI</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GOLDSOF, borderColor: GOLDBN, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }}>
              <FontAwesome5 name="lock" size={9} color={GOLD2} solid />
              <Text style={[T(500), { color: GOLD2, fontSize: 9.5 }]}>{maskPhone(account?.external_ref)}</Text>
            </View>
            <Pressable onPress={() => setTab('more')} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
              <Text style={[T(700), { color: BLACK, fontSize: 13 }]}>{initials(account?.registered_name)}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error ? (
        <View style={{ margin: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: DANGERBN, backgroundColor: DANGERSOF, gap: 10 }}>
          <Text style={[T(500), { color: DANGER, fontSize: 13, lineHeight: 19 }]}>{error}</Text>
          <Pressable style={{ alignSelf: 'flex-start', backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', gap: 6, alignItems: 'center' }}
            onPress={() => { setError(null); refreshAll(); }}>
            <FontAwesome5 name="sync" size={11} color={BLACK} solid />
            <Text style={[T(700), { color: BLACK, fontSize: 12 }]}>Jaribu tena</Text>
          </Pressable>
        </View>
      ) : route.page === 'index' && tab === 'home' ? (
        <HomePage account={account} phone={session.phone} history={history} loadingHist={loadingHist} refreshing={refreshing} onRefresh={refreshAll}
          onSend={startSend} onOpen={(id) => setRoute({ page: 'show', id })}
          onHistory={() => { setTab('history'); loadHistory(session.phone); }} />
      ) : route.page === 'index' && tab === 'history' ? (
        <HistoryPage history={history} loadingHist={loadingHist} refreshing={refreshing} onRefresh={refreshAll} onOpen={(id) => setRoute({ page: 'show', id })} />
      ) : route.page === 'index' && tab === 'more' ? (
        <MorePage account={account} phone={session.phone} onLogout={logout} onBack={() => setTab('home')} />
      ) : route.page === 'create' ? (
        <CreateFlow recipients={dir?.recipients || []} account={account} phone={session.phone} draft={draft} setDraft={setDraft}
          onBack={() => setRoute({ page: 'index' })}
          onDone={async (txnId) => { await refreshAll(); setDraft((d) => ({ ...d, ref: freshRef() })); setRoute({ page: 'show', id: txnId, justSent: true }); }} />
      ) : (
        <ShowPage txn={history.find((h) => h.transaction_id === route.id) || null} justSent={route.justSent}
          recipientName={recipientName} onBack={() => { setTab('history'); setRoute({ page: 'index' }); }} onSend={startSend} />
      )}

      {!showFlow && (
        <View style={{ flexDirection: 'row', borderTopColor: LINE, borderTopWidth: 1, backgroundColor: '#0a0a0a', paddingVertical: 6, paddingBottom: Platform.OS === 'ios' ? 20 : 8 }}>
          <TabBtn icon="home" label="Nyumbani" active={tab === 'home'} onPress={() => setTab('home')} />
          <TabBtn icon="paper-plane" label="Tuma" active={false} onPress={() => { setTab('home'); startSend(); }} />
          <TabBtn icon="history" label="Shughuli" active={tab === 'history'} onPress={() => { setTab('history'); loadHistory(session.phone); }} />
          <TabBtn icon="ellipsis-h" label="Zaidi" active={tab === 'more'} onPress={() => setTab('more')} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Mark({ size, rounded }) {
  const r = rounded ? (size || 34) / 3.4 : (size || 34) / 2;
  return (
    <View style={{ width: size || 34, height: size || 34, borderRadius: r, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 }}>
      <FontAwesome5 name="shield-alt" size={(size || 34) * 0.42} color={BLACK} solid />
    </View>
  );
}

const label = { color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 };
const btnGold = { backgroundColor: GOLD, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, flexDirection: 'row', gap: 8, shadowColor: GOLD, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 };
const btnDisabled = { backgroundColor: '#3a3a3a' };

/* ============ LOGIN ============ */
function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [hint, setHint] = useState(false);

  const clean = phone.replace(/\D/g, '');
  const canSubmit = clean.length >= 9 && pin.length === 4 && !busy;
  const showPin = clean.length >= 9;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const res = await dcsRequest({ method: 'POST', path: '/v1/client/login', payload: { phone: clean, pin } });
      if (res.status === 200 && res.body?.ok) onLogin({ phone: clean, account: res.body.account, at: Date.now() });
      else if (res.status === 401) { setErr('PIN si sahihi. Jaribu tena.'); setPin(''); }
      else if (res.status === 404) setErr('Namba hii haijasajiliwa.');
      else setErr('Haiwezi kuunganisha na API (' + (res.status || 'network') + ').');
    } catch (e) { setErr(String((e && e.message) || e)); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingVertical: 26 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <Mark size={48} />
            <View>
              <Text style={[T(700), { color: INK, fontSize: 19, lineHeight: 23 }]}>DCS Wallet</Text>
              <Text style={[T(400), { color: MUTED, fontSize: 10.5, letterSpacing: 0.8 }]}>DIGITAL CONSUMER SHIELD · TANZANIA</Text>
            </View>
          </View>

          <View style={[CARD_STYLE, { padding: 18, gap: 14 }]}>
            <View>
              <Text style={[T(700), { color: INK, fontSize: 17 }]}>Karibu tena</Text>
              <Text style={[T(400), { color: MUTED, fontSize: 12.5, marginTop: 3 }]}>Ingia kwa namba yako ya simu na PIN.</Text>
            </View>

            <View>
              <Text style={[T(500), label, { marginBottom: 6 }]}>Namba ya simu</Text>
              <Field icon="mobile-alt">
                <Text style={[T(600), { color: MUTED, fontSize: 15 }]}>+255</Text>
                <TextInput
                  style={[T(500), { color: INK, fontSize: 15, flex: 1 }]}
                  placeholder="7xy xxx xxx" placeholderTextColor="#4b5462"
                  keyboardType="phone-pad" value={clean}
                  onChangeText={(t) => { setPhone(t.replace(/\D/g, '')); setErr(null); }}
                  returnKeyType="done"
                />
              </Field>
            </View>

            {showPin && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[T(500), label]}>PIN</Text>
                  <Pressable onPress={() => setHint((v) => !v)} hitSlop={8}>
                    <Text style={[T(500), { color: SKY, fontSize: 11.5 }]}>{hint ? 'Ficha' : 'Msaada wa PIN?'}</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#151515', borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingTop: 2, padding: 14 }}>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {[0, 1, 2, 3].map((i) => <PinDot key={i} on={i < pin.length} />)}
                  </View>
                  <Pressable onPress={() => setPin((p) => p.slice(0, -1))} hitSlop={8}>
                    <FontAwesome5 name="backspace" size={16} color={MUTED} />
                  </Pressable>
                </View>
                {hint && (
                  <Text style={[T(400), { color: MUTED, fontSize: 11, marginTop: 8, lineHeight: 16 }]}>
                    Sandbox: PIN yako ni tarakimu 4 za mwisho za namba. Mfano 2557000777 → <Text style={[T(600), { color: GOLD2 }]}>0777</Text>.
                  </Text>
                )}
              </View>
            )}

            {err && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DANGERSOF, borderColor: DANGERBN, borderWidth: 1, borderRadius: 12, padding: 11 }}>
                <FontAwesome5 name="exclamation-circle" size={13} color={DANGER} solid />
                <Text style={[T(500), { color: DANGER, fontSize: 12.5, flex: 1 }]}>{err}</Text>
              </View>
            )}

            <Pressable style={[btnGold, !canSubmit && btnDisabled]} disabled={!canSubmit} onPress={submit}>
              {busy ? <ActivityIndicator color={BLACK} /> : <FontAwesome5 name="arrow-right" size={14} color={BLACK} solid />}
              <Text style={[T(700), { color: BLACK, fontSize: 15 }]}>Ingia</Text>
            </Pressable>
          </View>

          {showPin && (
            <View style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={[T(500), { color: MUTED, fontSize: 11.5, marginBottom: 10, marginTop: 4 }]}>Tumia PIN yako kwa usalama</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key k={d} key={d} onPress={() => pin.length < 4 && setPin(pin + d)} />)}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                <View style={keyBase}><FontAwesome5 name="keyboard" size={16} color="#4b5462" /></View>
                <Key k="0" onPress={() => pin.length < 4 && setPin(pin + '0')} />
                <Pressable style={keyBase} onPress={() => setPin((p) => p.slice(0, -1))}><FontAwesome5 name="backspace" size={17} color={GOLD2} /></Pressable>
              </View>
              <Text style={[T(400), { color: FAINT, fontSize: 10.5, marginTop: 16 }]}>© Digital Consumer Shield · Sandbox ya Maendeleo</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PinDot({ on }) {
  const sz = on ? 16 : 13;
  return <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: on ? GOLD : '#262626', borderColor: on ? GOLD : '#3a3a3a', borderWidth: 1.5 }} />;
}

const keyBase = { width: 72, height: 50, borderRadius: 12, backgroundColor: PANEL, borderColor: LINE, borderWidth: 1, alignItems: 'center', justifyContent: 'center' };
function Key({ k, onPress }) {
  return <Pressable style={keyBase} onPress={onPress}><Text style={[T(600), { color: INK, fontSize: 20 }]}>{k}</Text></Pressable>;
}

function Field({ icon, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#151515', borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
      <FontAwesome5 name={icon} size={14} color={GOLD} solid />
      {children}
    </View>
  );
}

/* ============ HOME ============ */
function HomePage({ account, phone, history, loadingHist, refreshing, onRefresh, onSend, onOpen, onHistory }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} colors={[GOLD]} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={[T(500), { color: MUTED, fontSize: 12 }]}>Habari,</Text>
          <Text style={[T(700), { color: INK, fontSize: 18 }]}>{account?.registered_name || 'Mtumiaji'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: OKSOF, borderColor: OKBN, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
          <FontAwesome5 name="check-circle" size={10} color={OK} solid />
          <Text style={[T(600), { color: OK, fontSize: 10 }]}>IMEHIFADHIWA</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#0c0c0c', borderColor: GOLDBN, borderWidth: 1, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: -70, right: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: GOLDSOF }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[T(600), { color: MUTED, fontSize: 10.5, letterSpacing: 1.6 }]}>SALIO LINALOPATIKANA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GOLDSOF, borderColor: GOLDBN, borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 }}>
            <FontAwesome5 name="coins" size={10} color={GOLD2} solid />
            <Text style={[T(700), { color: GOLD2, fontSize: 11 }]}>TZS</Text>
          </View>
        </View>
        <Text style={[T(700), { color: INK, fontSize: 32, marginTop: 8 }]}>{nf(account?.balance ?? 0).slice(4)}</Text>
        <Text style={[T(400), { color: MUTED, fontSize: 12, marginTop: 2 }]}>{account?.registered_name} · {maskPhone(phone)}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <HeroBtn ico="paper-plane" label="Tuma Pesa" onPress={onSend} gold />
          <HeroBtn ico="arrow-down" label="Pokea" onPress={() => Alert.alert('Namba yako ya kupokea', maskPhone(phone), [{ text: 'Funga', style: 'cancel' }])} />
          <HeroBtn ico="mobile-alt" label="Airtime" onPress={() => Alert.alert('Airtime', 'Itakuja hivi karibuni.', [{ text: 'Sawa', style: 'cancel' }])} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile ico="book-open" label="Kitabu" sub="Wapokeaji" color={SKY} onPress={() => Alert.alert('Kitabu cha wanawali', 'Wapokeaji 15 wako kwenye kitabu rasmi cha DCS.', [{ text: 'Sawa', style: 'cancel' }])} />
        <Tile ico="history" label="Kumbukumbu" sub="Shughuli" color={GOLD} onPress={onHistory} />
        <Tile ico="headset" label="Usaidizi" sub="Piga 100" color={BLUE} onPress={() => Alert.alert('Usaidizi wa DCS', 'Piga simu moja kwa moja: 100\nMon–Fri 7:00–21:00 · Sat–Sun 8:00–18:00', [{ text: 'Piga 100' }, { text: 'Funga', style: 'cancel' }])} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={[T(700), { color: INK, fontSize: 15 }]}>Shughuli za hivi karibuni</Text>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={onHistory}>
          <Text style={[T(600), { color: GOLD2, fontSize: 12.5 }]}>Zote</Text>
          <FontAwesome5 name="chevron-right" size={9} color={GOLD2} solid />
        </Pressable>
      </View>

      {loadingHist && !history.length ? <View style={{ padding: 18 }}><ActivityIndicator color={GOLD} /></View>
        : !history.length ? (
          <Pressable style={[CARD_STYLE, { padding: 20, alignItems: 'center', gap: 8 }]} onPress={onSend}>
            <FontAwesome5 name="paper-plane" size={19} color={GOLD} solid />
            <Text style={[T(500), { color: MUTED, fontSize: 12.5, textAlign: 'center' }]}>Hakuna malipo bado. Anza kutuma pesa zako za kwanza.</Text>
          </Pressable>
        ) : history.slice(0, 5).map((h) => <TxnRow key={h.transaction_id} h={h} onOpen={() => onOpen(h.transaction_id)} />)}

      <Pressable style={btnGold} onPress={onSend}>
        <FontAwesome5 name="paper-plane" size={14} color={BLACK} solid />
        <Text style={[T(700), { color: BLACK, fontSize: 15 }]}>Tuma Pesa Mpya</Text>
      </Pressable>
    </ScrollView>
  );
}

function HeroBtn({ ico, label, onPress, gold }) {
  return (
    <Pressable onPress={onPress} style={[gold ? { backgroundColor: GOLD, borderColor: GOLD } : { backgroundColor: '#151515', borderColor: LINE }, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10, borderWidth: 1 }]}>
      <FontAwesome5 name={ico} size={11} color={gold ? BLACK : INK} solid />
      <Text style={[T(600), { color: gold ? BLACK : INK, fontSize: 11 }]}>{label}</Text>
    </Pressable>
  );
}

function Tile({ ico, label, sub, color, onPress }) {
  return (
    <Pressable onPress={onPress} style={[{ flex: 1, alignItems: 'center', gap: 4, backgroundColor: PANEL, borderRadius: 14, borderColor: LINE, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 6 }]}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color === GOLD ? GOLDSOF : color + '1a', borderColor: color === GOLD ? GOLDBN : color + '33', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name={ico} size={14} color={color === GOLD ? GOLD2 : color} solid />
      </View>
      <Text style={[T(600), { color: INK, fontSize: 11 }]}>{label}</Text>
      <Text style={[T(400), { color: FAINT, fontSize: 9.5 }]}>{sub}</Text>
    </Pressable>
  );
}

function TxnRow({ h, onOpen }) {
  const st = clientStatus(h.decision, h.hold_status);
  const name = String(h.recipient_ref || h.recipient_external_ref || h.sender_ref || '').slice(0, 14);
  return (
    <Pressable onPress={onOpen} style={[CARD_STYLE, { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14 }]}>
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: st.soft, borderColor: st.bn, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesome5 name={h.decision === 'block' ? 'ban' : 'arrow-right'} size={12} color={st.color} solid />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T(600), { color: INK, fontSize: 13 }]} numberOfLines={1}>{h.decision === 'allow' || h.decision === 'warn' ? 'Kwenda ' : st.label + ' '}{name}</Text>
        <Text style={[T(400), { color: MUTED, fontSize: 11, marginTop: 1 }]}>{fmtTime(h.created_at)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[T(700), { color: INK, fontSize: 13.5 }]}>{Math.round(Number(h.amount)).toLocaleString('en-TZ')}</Text>
        <Text style={[T(600), { color: st.color, fontSize: 10.5, marginTop: 2 }]}>{st.label}</Text>
      </View>
    </Pressable>
  );
}

/* ============ HISTORY ============ */
function HistoryPage({ history, loadingHist, refreshing, onRefresh, onOpen }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 10 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} colors={[GOLD]} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
        <Text style={[T(700), { color: INK, fontSize: 16 }]}>Shughuli zote</Text>
        <Text style={[T(400), { color: MUTED, fontSize: 12 }]}>{history.length} malipo</Text>
      </View>
      {loadingHist && !history.length ? <View style={{ padding: 18 }}><ActivityIndicator color={GOLD} /></View>
        : !history.length ? <View style={[CARD_STYLE, { padding: 20, alignItems: 'center' }]}><Text style={[T(500), { color: MUTED, fontSize: 12.5 }]}>Hakuna shughuli bado.</Text></View>
          : history.map((h) => <TxnRow key={h.transaction_id} h={h} onOpen={() => onOpen(h.transaction_id)} />)}
    </ScrollView>
  );
}

/* ============ MORE ============ */
function MorePage({ account, phone, onLogout, onBack }) {
  const rows = [
    { ico: 'user-circle', t: 'Akaunti yangu', d: phoneDisplay(phone), color: GOLD, act: () => {} },
    { ico: 'book-open', t: 'Kitabu cha wanawali', d: 'Wapokeaji 15 waliojulikana', color: SKY, act: () => Alert.alert('Kitabu cha wanawali', 'Wapokeaji wako wa kudumu (15) wako kwenye kitabu rasmi cha DCS.\n\nPIN ya sandbox: tarakimu 4 za mwisho za namba yako.', [{ text: 'Sawa', style: 'cancel' }]) },
    { ico: 'bell', t: 'Arifa za SMS', d: 'Hati na makaguzi kwa SMS', color: BLUE, act: () => Alert.alert('Arifa za SMS', 'SMS za malipo zinatuma kwa +' + phone, [{ text: 'Sawa', style: 'cancel' }]) },
    { ico: 'info-circle', t: 'Kuhusu DCS', d: 'Kiungo cha benefikia yetu', color: '#7C5CE0', act: () => Alert.alert('Kuhusu DCS', 'DCS huthibitisha mpokeaji, hukagua wizi wa simu, na huwalinda wanyanyasaji haraka — kabla ya pesa kwenda.', [{ text: 'Sawa', style: 'cancel' }]) },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 10 }}>
      <View style={[CARD_STYLE, { padding: 20, alignItems: 'center', gap: 6 }]}>
        <View style={{ width: 62, height: 62, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 }}>
          <Text style={[T(700), { color: BLACK, fontSize: 22 }]}>{initials(account?.registered_name)}</Text>
        </View>
        <Text style={[T(700), { color: INK, fontSize: 16, marginTop: 4 }]}>{account?.registered_name}</Text>
        <Text style={[T(500), { color: GOLD2, fontSize: 13 }]}>{phoneDisplay(phone)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: OKSOF, borderColor: OKBN, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 }}>
          <FontAwesome5 name="lock" size={9} color={OK} solid />
          <Text style={[T(600), { color: OK, fontSize: 10 }]}>IMEHIJAZWA NA PIN</Text>
        </View>
      </View>
      {rows.map((r) => (
        <Pressable key={r.t} onPress={r.act} style={[CARD_STYLE, { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14 }]}>
          <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: r.color === GOLD ? GOLDSOF : r.color + '1a', borderColor: r.color === GOLD ? GOLDBN : r.color + '33', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name={r.ico} size={15} color={r.color === GOLD ? GOLD2 : r.color} solid />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T(600), { color: INK, fontSize: 13.5 }]}>{r.t}</Text>
            <Text style={[T(400), { color: MUTED, fontSize: 11.5 }]}>{r.d}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={11} color={FAINT} />
        </Pressable>
      ))}
      <Pressable onPress={onBack} style={[{ backgroundColor: PANEL, borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }]}>
        <FontAwesome5 name="home" size={13} color={INK} solid />
        <Text style={[T(600), { color: INK, fontSize: 13 }]}>Nyumbani</Text>
      </Pressable>
      <Pressable onPress={onLogout} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: DANGERSOF, borderColor: DANGERBN, borderWidth: 1, borderRadius: 12, paddingVertical: 13 }}>
        <FontAwesome5 name="sign-out-alt" size={14} color={DANGER} />
        <Text style={[T(700), { color: DANGER, fontSize: 14 }]}>Ondoka kwenye akaunti</Text>
      </Pressable>
      <Text style={[T(400), { color: FAINT, fontSize: 10, textAlign: 'center' }]}>DCS Wallet v1.3 · Sandbox ya Maendeleo</Text>
    </ScrollView>
  );
}

/* ============ CREATE FLOW ============ */
function CreateFlow({ recipients, account, phone, draft, setDraft, onBack, onDone }) {
  const [step, setStep] = useState('recipient');
  const [q, setQ] = useState('');
  const [manual, setManual] = useState('');
  const [custom, setCustom] = useState(false);
  const [pin, setPin] = useState('');
  const [verify, setVerify] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [running, setRunning] = useState(false);

  const recipientObj = recipients.find((r) => r.external_ref === draft?.recipient);
  const recipientFullName = recipientObj?.registered_name || verify?.recipient_display_name || (draft?.customRecipient ? draft.recipient : '');
  const filtered = recipients.filter((r) => (r.registered_name || '').toLowerCase().includes(q.toLowerCase()) || r.external_ref.includes(q));

  async function confirmRecipient() {
    setVerifying(true);
    try {
      const res = await dcsRequest({ method: 'POST', path: '/v1/recipients/verify', payload: { recipient_external_ref: draft.recipient, channel: 'mobile_money', tenant_txn_ref: draft.ref } });
      setVerify(res.body);
      if (res.status !== 200) throw new Error(res.body?.message || 'Ukaguzi wa mpokeaji umekosa.');
    } catch (e) { Alert.alert('Kosa', String((e && e.message) || e)); setVerify(null); }
    finally { setVerifying(false); }
  }

  async function send() {
    setRunning(true);
    try {
      const res = await dcsRequest({ method: 'POST', path: '/v1/transactions/validate', payload: {
        tenant_txn_ref: draft.ref, user_external_ref: phone, amount: Number(draft.amount), currency: 'TZS',
        channel: 'mobile_money', recipient_external_ref: draft.recipient, device_fingerprint: draft.device, occurred_at: new Date().toISOString(),
      } });
      if (!res.body || (res.status !== 200 && res.status !== 201)) throw new Error(res.body?.message || 'Kosa la API (' + res.status + ')');
      const dec = res.body.decision;
      if (dec === 'allow' || dec === 'warn' || dec === 'hold') {
        const settled = await dcsRequest({ method: 'POST', path: '/v1/transactions/' + res.body.transaction_id + '/settle', payload: {} });
        if (settled.status !== 200 && settled.status !== 201) throw new Error('Hati ya malipo haikutumika: ' + (settled.body?.message || settled.status));
      }
      await onDone(res.body.transaction_id);
    } catch (e) { Alert.alert('Kosa', String((e && e.message) || e)); }
    finally { setRunning(false); }
  }

  const stepTitle = step === 'recipient' ? 'Mpokeaji' : step === 'amount' ? 'Kiasi' : step === 'pin' ? 'PIN' : 'Hakikisha';
  const stepNo = step === 'recipient' ? 1 : step === 'amount' ? 2 : step === 'pin' ? 3 : 4;
  const back = () => {
    if (step === 'recipient') onBack();
    else if (step === 'amount') setStep('recipient');
    else if (step === 'pin') setStep('amount');
    else setStep('pin');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BG }}>
          <Pressable onPress={back} disabled={running} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: PANEL, borderColor: LINE, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="arrow-left" size={13} color={GOLD2} solid />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[T(700), { color: INK, fontSize: 14.5 }]}>{stepTitle}</Text>
            <Text style={[T(400), { color: MUTED, fontSize: 10 }]}>HATUA {stepNo}/4 · {step === 'recipient' ? 'WHO' : step === 'amount' ? 'KIASI GANI' : step === 'pin' ? 'WEKA KWA USALAMA' : 'MWISHO'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {[1, 2, 3, 4].map((n) => <View key={n} style={{ width: n > stepNo ? 6 : 18, height: 6, borderRadius: 3, backgroundColor: n <= stepNo ? GOLD : '#2a2a2a' }} />)}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 12 }} keyboardShouldPersistTaps="handled">
          {step === 'recipient' && (
            <View style={{ gap: 10 }}>
              <Field icon="search">
                <TextInput style={[T(400), { color: INK, fontSize: 14, flex: 1 }]} placeholder="Tafuta jina au namba..." placeholderTextColor="#4b5462" value={q} onChangeText={setQ} />
              </Field>
              <Text style={[T(500), label, { color: MUTED }]}>Wapokeaji wako</Text>
              {filtered.map((r, i) => (
                <Pressable key={r.external_ref} onPress={() => { setDraft((f) => ({ ...f, recipient: r.external_ref, customRecipient: false })); setStep('amount'); }} style={[CARD_STYLE, { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14 }]}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: i % 2 ? GOLDSOF : 'rgba(56,189,248,0.12)', borderColor: i % 2 ? GOLDBN : 'rgba(56,189,248,0.3)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[T(700), { color: i % 2 ? GOLD2 : SKY, fontSize: 13 }]}>{initials(r.registered_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T(600), { color: INK, fontSize: 13.5 }]}>{r.registered_name}</Text>
                    <Text style={[T(400), { color: MUTED, fontSize: 11 }]}>{phoneDisplay(r.external_ref)} · siku {r.account_age_days}</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={11} color={FAINT} />
                </Pressable>
              ))}
              <Pressable onPress={() => setCustom((v) => !v)} style={[CARD_STYLE, { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14 }]}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(124,92,224,0.15)', borderColor: 'rgba(124,92,224,0.35)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesome5 name="plus" size={13} color="#a78bfa" solid />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[T(600), { color: INK, fontSize: 13.5 }]}>Namba nyingine mpya</Text>
                  <Text style={[T(400), { color: MUTED, fontSize: 11 }]}>ingiza namba wewe</Text>
                </View>
                <FontAwesome5 name={custom ? 'chevron-down' : 'chevron-right'} size={11} color={FAINT} />
              </Pressable>
              {custom && (
                <View style={{ gap: 10 }}>
                  <Field icon="mobile-alt">
                    <TextInput style={[T(500), { color: INK, fontSize: 14, flex: 1 }]} keyboardType="phone-pad" placeholder="255777000000" placeholderTextColor="#4b5462" value={manual.replace(/\D/g, '')} onChangeText={(t) => setManual(t.replace(/\D/g, ''))} />
                  </Field>
                  <Pressable style={[btnGold, !(manual.replace(/\D/g, '').length >= 9) && btnDisabled]} disabled={manual.replace(/\D/g, '').length < 9}
                    onPress={() => { setDraft((f) => ({ ...f, recipient: manual.replace(/\D/g, ''), customRecipient: true })); setStep('amount'); }}>
                    <Text style={[T(700), { color: BLACK, fontSize: 14 }]}>Endelea</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {step === 'amount' && (
            <View style={{ gap: 12 }}>
              <TransferCard senderName={account?.registered_name} recipientRef={recipientObj?.registered_name || draft?.recipient} amount={draft?.amount} showAmount />
              <View>
                <Text style={[T(500), label, { marginBottom: 6 }]}>Kiasi (TZS)</Text>
                <TextInput style={{ backgroundColor: '#151515', borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: INK, fontSize: 22, fontFamily: 'Poppins_700Bold' }}
                  keyboardType="number-pad" value={String(draft?.amount ?? '')} onChangeText={(t) => setDraft((f) => ({ ...f, amount: t }))} placeholder="0" placeholderTextColor="#4b5462" />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[1000, 10000, 50000, 100000, 500000].map((v) => {
                  const on = Number(draft?.amount) === v;
                  return <Pressable key={v} onPress={() => setDraft((f) => ({ ...f, amount: v }))}
                    style={{ backgroundColor: on ? GOLD : PANEL, borderColor: on ? GOLD : LINE, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={[T(600), { color: on ? BLACK : INK, fontSize: 12 }]}>{nf(v)}</Text>
                  </Pressable>;
                })}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FontAwesome5 name="info-circle" size={11} color={FAINT} />
                <Text style={[T(400), { color: MUTED, fontSize: 11.5 }]}>Ada ya usafirishaji: TZS 0 · bure kwa sasa</Text>
              </View>
            </View>
          )}

          {step === 'pin' && (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <Text style={[T(500), { color: MUTED, fontSize: 12 }]}>Thibitisha ni wewe</Text>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {[0, 1, 2, 3].map((i) => <PinDot key={i} on={i < pin.length} />)}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap', maxWidth: 280 }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} k={d} onPress={() => pin.length < 4 && setPin(pin + d)} />)}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                <View style={keyBase} />
                <Key k="0" onPress={() => pin.length < 4 && setPin(pin + '0')} />
                <Pressable style={keyBase} onPress={() => setPin((p) => p.slice(0, -1))}><FontAwesome5 name="backspace" size={17} color={GOLD2} /></Pressable>
              </View>
              <Text style={[T(400), { color: MUTED, fontSize: 11, textAlign: 'center' }]}>Sandbox: PIN ni tarakimu 4 za mwisho za namba yako (mfano 0777).</Text>
            </View>
          )}

          {step === 'confirm' && (
            <View style={{ gap: 12 }}>
              <TransferCard senderName={account?.registered_name} recipientRef={recipientFullName || draft?.recipient} amount={draft?.amount} showAmount />
              {verifying ? <View style={{ padding: 10 }}><ActivityIndicator color={GOLD} /></View>
                : verify && (
                  <View style={[CARD_STYLE, { padding: 14, gap: 6, borderRadius: 14 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <FontAwesome5 name="user-check" size={14} color={OK} solid />
                      <Text style={[T(700), { color: INK, fontSize: 14 }]}>{recipientFullName}</Text>
                    </View>
                    <Text style={[T(400), { color: MUTED, fontSize: 11.5 }]}>{draft.recipient} · mteja kwa siku {verify.account_age_days ?? '?'}</Text>
                    {verify.first_time_recipient && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GOLDSOF, borderColor: GOLDBN, borderWidth: 1, borderRadius: 10, padding: 8 }}>
                        <FontAwesome5 name="exclamation-triangle" size={11} color={GOLD2} solid />
                        <Text style={[T(500), { color: GOLD2, fontSize: 11.5, flex: 1 }]}>Kwanza kabisa kumtumia mtu huyu — hakikisha sana!</Text>
                      </View>
                    )}
                  </View>
                )}
              {!verifying && verify && (
                <Pressable style={btnGold} onPress={send} disabled={running}>
                  {running ? <ActivityIndicator color={BLACK} /> : <FontAwesome5 name="check-circle" size={15} color={BLACK} solid />}
                  <Text style={[T(700), { color: BLACK, fontSize: 15 }]}>Thibitisha & Tuma {nf(draft?.amount)}</Text>
                </Pressable>
              )}
            </View>
          )}

          {step !== 'confirm' && (
            <Pressable
              style={[btnGold, !((step === 'recipient' ? draft?.recipient : step === 'amount' ? Number(draft?.amount) > 0 : pin.length === 4)) && btnDisabled]}
              disabled={!(step === 'recipient' ? draft?.recipient : step === 'amount' ? Number(draft?.amount) > 0 : pin.length === 4)}
              onPress={() => {
                if (step === 'recipient') setStep('amount');
                else if (step === 'amount') { setStep('pin'); setPin(''); }
                else { setDraft((f) => ({ ...f, ref: freshRef() })); setStep('confirm'); confirmRecipient(); }
              }}>
              <Text style={[T(700), { color: BLACK, fontSize: 15 }]}>Endelea ›</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TransferCard({ senderName, recipientRef, amount, showAmount }) {
  const Half = ({ name, sub, tint, fg }) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[T(700), { color: fg, fontSize: 13 }]}>{initials(name)}</Text>
      </View>
      <Text style={[T(500), { color: INK, fontSize: 11, marginTop: 6, maxWidth: 108 }]} numberOfLines={1}>{name || 'Wewe'}</Text>
      <Text style={[T(400), { color: FAINT, fontSize: 8.5, letterSpacing: 0.8, marginTop: 2 }]}>{sub}</Text>
    </View>
  );
  return (
    <View style={[CARD_STYLE, { padding: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 14 }]}>
      <Half name={senderName} sub="ANAYETUMA" tint="#1a1a1a" fg={GOLD2} />
      <View style={{ alignItems: 'center', paddingHorizontal: 6, gap: 2 }}>
        {showAmount && amount ? <Text style={[T(700), { color: GOLD2, fontSize: 12.5 }]}>{nf(amount)}</Text> : <FontAwesome5 name="arrow-right" size={15} color={FAINT} solid />}
        <Text style={[T(400), { color: FAINT, fontSize: 8 }]}>TZS</Text>
      </View>
      <Half name={recipientRef} sub="ANAYEPOKEA" tint={GOLD} fg={BLACK} />
    </View>
  );
}

/* ============ SHOW ============ */
function ShowPage({ txn, justSent, recipientName, onBack, onSend }) {
  if (!txn) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: BG }}>
        <View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: OKSOF, borderColor: OKBN, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesome5 name="check-circle" size={30} color={OK} solid />
        </View>
        <Text style={[T(700), { color: INK, fontSize: 17 }]}>Malipo yametumwa!</Text>
        <Text style={[T(400), { color: MUTED, fontSize: 12.5, textAlign: 'center' }]}>Hati iko kwenye orodha ya shughuli zako.</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' }}>
          <Pressable onPress={onBack} style={[{ flex: 1, backgroundColor: PANEL, borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[T(700), { color: INK, fontSize: 13 }]}>‹ Nyumbani</Text>
          </Pressable>
          <Pressable onPress={onSend} style={[btnGold, { flex: 2 }]}>
            <Text style={[T(700), { color: BLACK, fontSize: 13 }]}>✈ Tuma Nyingine</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const st = clientStatus(txn.decision, txn.hold_status);
  const name = recipientName(txn.recipient_ref) || txn.recipient_ref || txn.recipient_external_ref || '';
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: st.soft, borderColor: st.bn, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
          <FontAwesome5 name={st.icon} size={12} color={st.color} solid />
          <Text style={[T(700), { color: st.color, fontSize: 12.5 }]}>{justSent && st.color === DANGER ? st.label + ' — pesa hazijakwenda' : st.label}</Text>
        </View>
        <Text style={[T(700), { color: INK, fontSize: 30, marginVertical: 6 }]}>{nf(txn.amount)}</Text>
        <Text style={[T(400), { color: MUTED, fontSize: 12 }]}>Kwenda <Text style={[T(600), { color: INK }]}>{name}</Text></Text>
      </View>

      <View style={[CARD_STYLE, { padding: 15, gap: 11, borderRadius: 14 }]}>
        {[
          ['Hali', st.label, st.color],
          ['Kiasi', Math.round(Number(txn.amount)).toLocaleString('en-TZ') + ' TZS', INK],
          ['Mpokeaji', name, INK],
          ['Namba ya mpokeaji', txn.recipient_ref || txn.recipient_external_ref, INK],
          ['Tarehe', fmtTime(txn.created_at), INK],
          ['Kumbukumbu', txn.transaction_reference || String(txn.transaction_id).slice(0, 16), INK],
        ].map(([k, v, c]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomColor: LINE, borderBottomWidth: 1, paddingBottom: 9 }}>
            <Text style={[T(400), { color: MUTED, fontSize: 11.5 }]}>{k}</Text>
            <Text style={[T(600), { color: c, fontSize: 12, flex: 1, textAlign: 'right' }]} numberOfLines={2}>{v}</Text>
          </View>
        ))}
      </View>

      {st.label === 'Inakaguliwa' && (
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: GOLDSOF, borderColor: GOLDBN, borderWidth: 1, borderRadius: 14, padding: 13, alignItems: 'flex-start' }}>
          <FontAwesome5 name="clock" size={13} color={GOLD2} solid />
          <Text style={[T(400), { color: GOLD2, fontSize: 12, lineHeight: 18, flex: 1 }]}>Pesa zimeshikiliwa kwa usalama wakati wa ukaguzi. Utapata SMS ya kuthibitisha; kama hukupeleka wewe piga simu 100.</Text>
        </View>
      )}
      {st.label === 'Imekataliwa' && (
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: DANGERSOF, borderColor: DANGERBN, borderWidth: 1, borderRadius: 14, padding: 13, alignItems: 'flex-start' }}>
          <FontAwesome5 name="shield-alt" size={13} color={DANGER} solid />
          <Text style={[T(400), { color: DANGER, fontSize: 12, lineHeight: 18, flex: 1 }]}>Malipo yamekataliwa — pesa zako hazijatoka nje ya akaunti. Kwa maelezo piga simu 100.</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Pressable onPress={onBack} style={{ flex: 1, backgroundColor: PANEL, borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[T(700), { color: INK, fontSize: 13 }]}>‹ Nyumbani</Text>
        </Pressable>
        <Pressable onPress={onSend} style={[btnGold, { flex: 2 }]}>
          <Text style={[T(700), { color: BLACK, fontSize: 13 }]}>✈ Tuma Nyingine</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ============ TAB BAR ============ */
function TabBtn({ icon, label, active, onPress }) {
  return (
    <Pressable style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 3 }} onPress={onPress}>
      <FontAwesome5 name={icon} size={17} color={active ? GOLD : FAINT} solid={active} />
      <Text style={[T(600), { color: active ? GOLD : MUTED, fontSize: 10 }]}>{label}</Text>
    </Pressable>
  );
}