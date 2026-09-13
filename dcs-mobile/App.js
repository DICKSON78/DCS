import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { dcsRequest } from './src/api';

const GOLD = '#FFB900';
const COIN = '#FFC533';
const BG = '#05070d';
const SURFACE = '#0b1220';
const LINE = '#1e293b';
const MUTED = '#7c8aa0';
const TEXT = '#eef2f8';
const OK = '#34d399';
const WARN = '#fbbf24';
const DANGER = '#f87171';

const nf = (n) => 'TZS ' + Math.round(Number(n) || 0).toLocaleString('en-TZ');
const fmtTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const initials = (name) =>
  String(name || '?').split(/\s+/).slice(0, 2).map((w) => (w[0] || '')).join('').toUpperCase();
const freshRef = () => 'SIM-' + Math.floor(Date.now() / 1000) + '-' + Math.floor(Math.random() * 900 + 100);

function clientStatus(d, hold) {
  if (d === 'block') return { label: 'Imekataliwa', color: DANGER };
  if (d === 'hold' && hold && hold !== 'released') return { label: 'Inakaguliwa', color: WARN };
  return { label: 'Imekamilika', color: OK };
}

export default function App() {
  const [dir, setDir] = useState(null);
  const [sender, setSender] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingDir, setLoadingDir] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('home');
  const [route, setRoute] = useState({ page: 'index' });
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const account = useMemo(() => dir?.senders?.find((s) => s.external_ref === sender), [dir, sender]);
  const recipientName = (ref) => dir?.recipients?.find((r) => r.external_ref === ref)?.registered_name || null;

  const loadDirectory = async () => {
    try {
      const res = await dcsRequest({ method: 'GET', path: '/v1/client/directory' });
      if (res.status === 200 && Array.isArray(res.body?.senders)) {
        setDir(res.body);
        setSender((prev) => prev || res.body.senders[0]?.external_ref || null);
        setError(null);
      } else {
        setError('API haijibu — angalia API ya DCS imeanza (' + (res.status || 'network') + ')');
      }
    } catch (e) {
      setError(String((e && e.message) || e));
    } finally {
      setLoadingDir(false);
    }
  };

  const loadHistory = async (ref) => {
    if (!ref) return;
    setLoadingHist(true);
    try {
      const res = await dcsRequest({ method: 'GET', path: '/v1/transactions?user_external_ref=' + encodeURIComponent(ref) + '&limit=50' });
      if (res.status === 200) setHistory(res.body.transactions || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHist(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await loadDirectory();
    await loadHistory(sender);
    setRefreshing(false);
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    loadHistory(sender);
  }, [sender]);

  useEffect(() => {
    if (tab === 'home') loadDirectory();
  }, [tab]);

  const startSend = () => {
    setDraft({ sender, recipient: '', customRecipient: false, amount: account?.typical_amount || 100000, device: account?.known_devices?.[0] || sender + '-dev', night: false, ref: freshRef() });
    setRoute({ page: 'create', step: 'recipient' });
  };

  const showFlow = route.page !== 'index';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      {!showFlow && (
        <View style={css.header}>
          <View>
            <Text style={css.headerTitle}>DCS Wallet</Text>
            <Text style={css.headerSub}>BENKI · SIMU YAKO YA MALIPO</Text>
          </View>
          <View style={css.headRight}>
            <View style={[css.pillLine, { backgroundColor: OK + '18', borderColor: OK + '55' }]}>
              <Text style={[css.pillText, { color: OK }]}>● Mliango wazi</Text>
            </View>
            <Pressable onPress={() => { setSender(null); }} style={css.avatarSm}>
              <Text style={css.avatarSmText}>{initials(account?.registered_name)}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {error ? (
        <View style={css.errorBox}>
          <Text style={css.errorText}>{error}</Text>
          <Pressable style={css.btnGold} onPress={() => { setError(null); setLoadingDir(true); loadDirectory(); }}>
            <Text style={css.btnGoldText}>Jaribu tena</Text>
          </Pressable>
        </View>
      ) : loadingDir && !dir ? (
        <View style={css.center}>
          <ActivityIndicator color={GOLD} />
          <Text style={css.mutedText}>Inafungua akaunti yako...</Text>
        </View>
      ) : route.page === 'index' && tab === 'home' ? (
        <HomePage
          account={account}
          sender={sender}
          senders={dir?.senders || []}
          history={history}
          loadingHist={loadingHist}
          refreshing={refreshing}
          onRefresh={refreshAll}
          onSender={(ref) => setSender(ref)}
          onSend={startSend}
          onOpen={(id) => setRoute({ page: 'show', id })}
          onHistory={() => setTab('history')}
        />
      ) : route.page === 'index' && tab === 'history' ? (
        <HistoryPage
          history={history}
          loadingHist={loadingHist}
          refreshing={refreshing}
          onRefresh={refreshAll}
          onOpen={(id) => setRoute({ page: 'show', id })}
        />
      ) : route.page === 'index' && tab === 'more' ? (
        <MorePage account={account} recipientName={recipientName} onBackToHome={() => setTab('home')} />
      ) : route.page === 'create' ? (
        <CreateFlow
          recipients={dir?.recipients || []}
          account={account}
          draft={draft}
          setDraft={setDraft}
          onBack={() => setRoute({ page: 'index' })}
          onDone={async (txnId) => {
            await refreshAll();
            setDraft((d) => ({ ...d, ref: freshRef() }));
            setRoute({ page: 'show', id: txnId, justSent: true });
          }}
        />
      ) : (
        <ShowPage
          txn={history.find((h) => h.transaction_id === route.id) || null}
          justSent={route.justSent}
          recipientName={recipientName}
          onBack={() => { setTab('history'); setRoute({ page: 'index' }); }}
          onSend={startSend}
        />
      )}

      {!showFlow && (
        <View style={css.tabBar}>
          <TabBtn icon="🏠" label="Nyumbani" active={tab === 'home'} onPress={() => setTab('home')} />
          <TabBtn icon="✈" label="Tuma" active={false} onPress={() => { setTab('home'); startSend(); }} />
          <TabBtn icon="🕒" label="Shughuli" active={tab === 'history'} onPress={() => { setTab('history'); loadHistory(sender); }} />
          <TabBtn icon="☰" label="Zaidi" active={tab === 'more'} onPress={() => setTab('more')} />
        </View>
      )}
    </SafeAreaView>
  );
}

/* ---------------- HOME ---------------- */
function HomePage({ account, sender, senders, history, loadingHist, refreshing, onRefresh, onSender, onSend, onOpen, onHistory }) {
  return (
    <ScrollView
      contentContainerStyle={css.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} colors={[GOLD]} />}
    >
      <View style={css.greetRow}>
        <View style={css.avatar}><Text style={css.avatarText}>{initials(account?.registered_name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={css.greetSmall}>Habari,</Text>
          <Text style={css.greet}>{account?.registered_name?.split(' ')[0] || 'Mtumiaji'}</Text>
        </View>
        <View style={[css.pillLine, { backgroundColor: OK + '18', borderColor: OK + '55' }]}>
          <Text style={[css.pillText, { color: OK }]}># {account?.external_ref}</Text>
        </View>
      </View>

      <View style={css.hero}>
        <Text style={css.heroLabel}>SALIO LAKO</Text>
        <Text style={css.heroBalance}>{nf(account?.balance ?? 0)}</Text>
        <Text style={css.heroSub}>{account?.registered_name} · mteja wa siku {account?.account_age_days}</Text>
        <View style={css.heroActions}>
          <HeroBtn label="Tuma Pesa" color={GOLD} onPress={onSend} main />
          <HeroBtn label="Pokea" color={OK} onPress={() =>
            Alert.alert('Namba yako ya kupokea', account?.external_ref || '---', [
              { text: 'Nakili', onPress: () => {} },
              { text: 'Funga', style: 'cancel' },
            ])
          } />
          <HeroBtn label="Airtime" color="#38bdf8" onPress={() =>
            Alert.alert('Airtime', 'Nunua airtime moja kwa moja kutoka salio lako.\n(feature inayofuata)', [{ text: 'Sawa', style: 'cancel' }])
          } />
        </View>
      </View>

      <View style={css.featureRow}>
        <Feature icon="✈" label="Tuma" sub="pesa kwenda" color={GOLD} onPress={onSend} />
        <Feature icon="🕒" label="Shughuli" sub="malipo yote" color="#38bdf8" onPress={onHistory} />
        <Feature icon="⤵" label="Pokea" sub="namba yako" color={OK} onPress={() => Alert.alert('Namba yako', account?.external_ref || '---')} />
        <Feature icon="🎧" label="Usaidizi" sub="piga 100" color="#a78bfa" onPress={() =>
          Alert.alert('Usaidizi wa DCS', 'Piga simu moja kwa moja: 100\nMon-Fri 7:00-21:00, Sat-Sun 8:00-18:00', [{ text: 'Piga 100', onPress: () => {} }, { text: 'Funga', style: 'cancel' }])
        } />
      </View>

      {senders.length > 1 && (
        <View style={css.switchRow}>
          <Text style={css.switchLabel}>Badilisha akaunti</Text>
          {senders.map((s) => (
            <Pressable key={s.external_ref} onPress={() => onSender(s.external_ref)} style={[css.switchChip, s.external_ref === sender && css.switchChipOn]}>
              <Text style={[css.switchChipText, s.external_ref === sender && { color: '#06101f' }]}>{s.registered_name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={css.sectionHead}>
        <Text style={css.sectionTitle}>Shughuli za hivi karibuni</Text>
        <Pressable onPress={onHistory}><Text style={css.seeAll}>Ongea zote ›</Text></Pressable>
      </View>
      {loadingHist && !history.length ? (
        <View style={css.center}><ActivityIndicator color={GOLD} /></View>
      ) : !history.length ? (
        <Pressable style={css.emptyState} onPress={onSend}>
          <Text style={css.emptyIco}>💸</Text>
          <Text style={css.emptyTxt}>Hakuna malipo bado. Tuma pesa zako za kwanza!</Text>
        </Pressable>
      ) : (
        history.slice(0, 6).map((h) => <TxnRow key={h.transaction_id} h={h} onOpen={() => onOpen(h.transaction_id)} />)
      )}

      <Pressable style={css.btnGold} onPress={onSend}>
        <Text style={css.btnGoldText}>✈ Tuma pesa mpya</Text>
      </Pressable>
    </ScrollView>
  );
}

function HeroBtn({ label, color, onPress, main }) {
  return (
    <Pressable style={[css.heroBtn, main && { backgroundColor: GOLD }, { borderColor: color }]} onPress={onPress}>
      <Text style={[css.heroBtnText, main && { color: '#06101f', fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

function Feature({ icon, label, sub, color, onPress }) {
  return (
    <Pressable style={css.feature} onPress={onPress}>
      <View style={[css.featureIco, { borderColor: color }]}><Text style={{ fontSize: 18, color }}>{icon}</Text></View>
      <Text style={css.featureName}>{label}</Text>
      <Text style={css.featureSub}>{sub}</Text>
    </Pressable>
  );
}

function TxnRow({ h, onOpen }) {
  const st = clientStatus(h.decision, h.hold_status);
  const name = String(h.recipient_ref || h.recipient_external_ref || h.sender_ref || '').slice(0, 14);
  return (
    <Pressable style={css.row} onPress={onOpen}>
      <View style={[css.rowIco, { borderColor: st.color }]}>
        <Text style={{ color: st.color, fontSize: 13, fontWeight: '700' }}>{st.label === 'Imekataliwa' ? '✕' : st.label === 'Inakaguliwa' ? '⏳' : '✓'}</Text>
      </View>
      <View style={css.rowMid}>
        <Text style={css.rowTitle}>{st.label !== 'Imekamilika' ? st.label + ' ' : 'Kwenda '}{name}</Text>
        <Text style={css.rowSub}>{fmtTime(h.created_at)} · {h.transaction_reference || h.transaction_id?.slice?.(0, 6) || ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={css.rowAmt}>{Math.round(Number(h.amount)).toLocaleString('en-TZ')}</Text>
        <Text style={[css.rowTag, { color: st.color }]}>{st.label}</Text>
      </View>
    </Pressable>
  );
}

/* ---------------- HISTORY ---------------- */
function HistoryPage({ history, loadingHist, refreshing, onRefresh, onOpen }) {
  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={css.page}
      data={history}
      keyExtractor={(h) => String(h.transaction_id)}
      ListHeaderComponent={
        <View style={css.sectionHead}>
          <Text style={css.sectionTitle}>Shughuli zote</Text>
          <Text style={css.mutedText}>({history.length} kurekodiwa)</Text>
        </View>
      }
      ListEmptyComponent={
        loadingHist ? (
          <View style={css.center}><ActivityIndicator color={GOLD} /></View>
        ) : (
          <View style={css.emptyState}><Text style={css.emptyTxt}>Hakuna shughuli za malipo bado.</Text></View>
        )
      }
      renderItem={({ item }) => <TxnRow h={item} onOpen={() => onOpen(item.transaction_id)} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} colors={[GOLD]} />}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
}

/* ---------------- MORE ---------------- */
function MorePage({ account, recipientName, onBackToHome }) {
  const myNumber = account?.external_ref || '---';
  const mascot = account?.registered_name || 'Wewe';
  const items = [
    { icon: '🧾', t: 'Bonyeza kwenye malipo', d: 'hakiki "Nani, kiasi gani, na lini"', act: () => onBackToHome() },
    { icon: '📲', t: 'Funga tena?', d: 'Badilisha akaunti yako hapa chini', act: () => {} },
    { icon: '🛡', t: 'Usalama', d: 'DCS inakagua kila malipo kwa usalama wa pesa zako', act: () => {} },
  ];
  return (
    <ScrollView contentContainerStyle={css.page}>
      <View style={css.profileCard}>
        <View style={css.avatarLg}><Text style={css.avatarLgText}>{initials(mascot)}</Text></View>
        <Text style={css.profileName}>{mascot}</Text>
        <Text style={css.profileSub}>{myNumber}</Text>
        <View style={[css.pillLine, { backgroundColor: OK + '18', borderColor: OK + '55', alignSelf: 'center', marginTop: 8 }]}>
          <Text style={[css.pillText, { color: OK }]}>Akaunti imekamilika ✓</Text>
        </View>
      </View>

      {items.map((it, i) => (
        <Pressable key={i} style={css.moreRow} onPress={it.act}>
          <Text style={{ fontSize: 18 }}>{it.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={css.moreTitle}>{it.t}</Text>
            <Text style={css.moreSub}>{it.d}</Text>
          </View>
          <Text style={css.chev}>›</Text>
        </Pressable>
      ))}

      <View style={css.aboutBox}>
        <Text style={css.aboutTitle}>Kiungo cha benefikia</Text>
        <Text style={css.aboutBody}>DCS inatumia benki sahihi ya akaunti — asilimia 100 ya maelezo na hakiki ya mpokeaji inatoka kwenye kitabu kikuu cha DCS, si sandbox inayopongiwa.</Text>
      </View>
      <Text style={css.versionTxt}>DCS Wallet v1.0.0 · Sandbox ya Mteja ya Maendeleo</Text>
    </ScrollView>
  );
}

/* ---------------- CREATE FLOW ---------------- */
function CreateFlow({ recipients, account, draft, setDraft, onBack, onDone }) {
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

  const filtered = recipients.filter((r) =>
    (r.registered_name || '').toLowerCase().includes(q.toLowerCase()) || r.external_ref.includes(q)
  );

  async function confirmRecipient() {
    setVerifying(true);
    try {
      const res = await dcsRequest({
        method: 'POST',
        path: '/v1/recipients/verify',
        payload: { recipient_external_ref: draft.recipient, channel: 'mobile_money', tenant_txn_ref: draft.ref },
      });
      setVerify(res.body);
      if (res.status !== 200) throw new Error(res.body?.message || 'Ukaguzi wa mpokeaji umekosa.');
    } catch (e) {
      Alert.alert('Kosa', String((e && e.message) || e));
      setVerify(null);
    } finally {
      setVerifying(false);
    }
  }

  async function send() {
    setRunning(true);
    try {
      const res = await dcsRequest({
        method: 'POST',
        path: '/v1/transactions/validate',
        payload: {
          tenant_txn_ref: draft.ref,
          user_external_ref: draft.sender,
          amount: Number(draft.amount),
          currency: 'TZS',
          channel: 'mobile_money',
          recipient_external_ref: draft.recipient,
          device_fingerprint: draft.device,
          occurred_at: new Date().toISOString(),
        },
      });
      if (!res.body || (res.status !== 200 && res.status !== 201)) {
        throw new Error(res.body?.message || 'Kosa la API (' + res.status + ')');
      }
      const dec = res.body.decision;
      if (dec === 'allow' || dec === 'warn' || dec === 'hold') {
        const settled = await dcsRequest({
          method: 'POST',
          path: '/v1/transactions/' + res.body.transaction_id + '/settle',
          payload: {},
        });
        if (settled.status !== 200 && settled.status !== 201) {
          throw new Error('Hati ya malipo haikutumika: ' + (settled.body?.message || settled.status));
        }
      }
      await onDone(res.body.transaction_id);
    } catch (e) {
      Alert.alert('Kosa', String((e && e.message) || e));
    } finally {
      setRunning(false);
    }
  }

  const stepNo = step === 'recipient' ? '1' : step === 'amount' ? '2' : step === 'pin' ? '3' : '✓';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={css.flowTop}>
        <Pressable onPress={() => { if (step === 'recipient') onBack(); else if (step === 'amount') setStep('recipient'); else if (step === 'pin') setStep('amount'); else setStep('pin'); }} style={css.flowBack} disabled={running}>
          <Text style={css.flowBackTxt}>‹ Hatua ya awali</Text>
        </Pressable>
        <Text style={css.flowNextTo}>1. Mpokeaji · 2. Kiasi · 3. PIN · 4. Hakiki</Text>
      </View>
      <ScrollView contentContainerStyle={css.page} keyboardShouldPersistTaps="handled">
        <View style={css.stepTop}>
          <Text style={css.stepNo}>{stepNo}</Text>
          <View>
            <Text style={css.stepTitle}>{step === 'recipient' ? 'Chagua mpokeaji' : step === 'amount' ? 'Weka kiasi cha kutuma' : step === 'pin' ? 'Weka PIN yako' : 'Hakikisha & tuma'}</Text>
            <Text style={css.stepSub}>tuma pesa kwa kitabu chako rasmi</Text>
          </View>
        </View>

        {step === 'recipient' && (
          <View>
            <TextInput style={css.input} placeholder="Tafuta jina au namba..." placeholderTextColor={MUTED} value={q} onChangeText={setQ} autoFocus />
            <View style={{ marginTop: 10, gap: 8 }}>
              {filtered.map((r, i) => (
                <Pressable key={r.external_ref} style={css.contact} onPress={() => { setDraft((f) => ({ ...f, recipient: r.external_ref, customRecipient: false })); setStep('amount'); }}>
                  <View style={[css.cAvatar, { backgroundColor: i % 2 ? COIN : '#38bdf8' }]}>
                    <Text style={[css.cAvatarText, i % 2 && { color: '#06101f' }]}>{initials(r.registered_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={css.cName}>{r.registered_name}</Text>
                    <Text style={css.cSub}>{r.external_ref} · mteja {r.account_age_days} siku</Text>
                  </View>
                  <Text style={css.chev}>›</Text>
                </Pressable>
              ))}
              <Pressable style={css.contact} onPress={() => setCustom((v) => !v)}>
                <View style={[css.cAvatar, { backgroundColor: '#a78bfa' }]}>
                  <Text style={[css.cAvatarText, { color: '#06101f' }]}>+</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={css.cName}>Namba nyingine mpya</Text>
                  <Text style={css.cSub}>ingiza namba wewe mwenyewe</Text>
                </View>
                <Text style={css.chev}>{custom ? '⌄' : '›'}</Text>
              </Pressable>
              {custom && (
                <View style={{ gap: 8 }}>
                  <TextInput style={css.input} keyboardType="number-pad" placeholder="mfano 255777000000" placeholderTextColor={MUTED} value={manual} onChangeText={(t) => setManual(t.replace(/\D/g, ''))} />
                  <Pressable style={css.btnGold} disabled={manual.replace(/\D/g, '').length < 8} onPress={() => { setDraft((f) => ({ ...f, recipient: manual.replace(/\D/g, ''), customRecipient: true })); setStep('amount'); }}>
                    <Text style={css.btnGoldText}>Endelea na namba hii ›</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {step === 'amount' && (
          <View>
            <TransferCard senderName={account?.registered_name} recipientRef={draft?.recipient} amount={draft?.amount} showAmount />
            <Text style={css.label}>Kiasi (TZS)</Text>
            <TextInput style={css.input} keyboardType="number-pad" value={String(draft?.amount ?? '')} onChangeText={(t) => setDraft((f) => ({ ...f, amount: t }))} placeholder="0" placeholderTextColor={MUTED} />
            <View style={css.quickRow}>
              {[1000, 10000, 50000, 100000, 500000].map((v) => (
                <Pressable key={v} onPress={() => setDraft((f) => ({ ...f, amount: v }))} style={[css.quickChip, Number(draft?.amount) === v && css.quickChipOn]}>
                  <Text style={[css.quickChipText, Number(draft?.amount) === v && { color: '#06101f' }]}>{nf(v)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={css.mutedNote}>Gharama ya kutuma: TZS 0 · Bure ≡ {'\u00b7'}</Text>
          </View>
        )}

        {step === 'pin' && (
          <View>
            <View style={css.pinDots}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[css.pinDot, i < pin.length && css.pinDotOn]} />)}
            </View>
            <View style={css.keypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <Pressable key={d} style={css.key} onPress={() => pin.length < 4 && setPin(pin + d)}><Text style={css.keyText}>{d}</Text></Pressable>
              ))}
              <Pressable style={css.key} onPress={() => setPin('')}><Text style={css.keyText}>↺</Text></Pressable>
              <Pressable style={css.key} onPress={() => pin.length < 4 && setPin(pin + '0')}><Text style={css.keyText}>0</Text></Pressable>
              <Pressable style={css.key} onPress={() => setPin((p) => p.slice(0, -1))}><Text style={css.keyText}>⌫</Text></Pressable>
            </View>
            <Text style={css.mutedNote}>Sandbox: PIN yoyote ya tarakimu 4 (mfano 1234).</Text>
          </View>
        )}

        {step === 'confirm' && (
          <View>
            <TransferCard senderName={account?.registered_name} recipientRef={recipientFullName || draft?.recipient} amount={draft?.amount} showAmount />
            {verifying ? (
              <View style={css.center}><ActivityIndicator color={GOLD} /><Text style={css.mutedText}>Inakagua jina la mpokeaji...</Text></View>
            ) : verify ? (
              <View style={css.verifyBox}>
                <Text style={css.verifyLine}>Mpokeaji: <Text style={{ color: TEXT, fontWeight: '700' }}>{recipientFullName}</Text></Text>
                <Text style={css.verifyLine}>{draft.recipient} · siku {verify.account_age_days ?? '?'} · {verify.verified ? 'imesajiliwa ✓' : 'HAIPO kwenye daftari rasmi'}</Text>
                {verify.first_time_recipient && <Text style={[css.verifyLine, { color: WARN }]}>⚠ Kwanza kabisa kumtumia mtu huyu — hakikisha sana!</Text>}
              </View>
            ) : null}
            <Text style={css.mutedNote}>"Huyu ndiye unayemtumia?" — DCS inathibitisha hii kabla malipo hayajakwenda.</Text>
            {!verifying && verify && (
              <Pressable style={css.btnGold} onPress={send} disabled={running}>
                {running ? <ActivityIndicator color="#06101f" /> : <Text style={css.btnGoldText}>✓ Thibitisha & Tuma {nf(draft?.amount)}</Text>}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TransferCard({ senderName, recipientRef, amount, showAmount }) {
  return (
    <View style={css.transfer}>
      <View style={css.tSide}>
        <View style={[css.tAva, { backgroundColor: '#38bdf8' }]}><Text style={css.tAvaText}>{initials(senderName)}</Text></View>
        <Text style={css.tName} numberOfLines={1}>{senderName || 'Wewe'}</Text>
        <Text style={css.tSub}>ANAYETUMA</Text>
      </View>
      <View style={css.tMid}>
        {showAmount && amount ? <Text style={css.tAmount}>{nf(amount)}</Text> : <Text style={css.tArrow}>→</Text>}
        <Text style={css.tSub}>TZS</Text>
      </View>
      <View style={css.tSide}>
        <View style={[css.tAva, { backgroundColor: COIN }]}><Text style={[css.tAvaText, { color: '#06101f' }]}>{initials(recipientRef)}</Text></View>
        <Text style={css.tName} numberOfLines={1}>{recipientRef || 'Mpokeaji'}</Text>
        <Text style={css.tSub}>ANAYEPOKEA</Text>
      </View>
    </View>
  );
}

/* ---------------- SHOW ---------------- */
function ShowPage({ txn, justSent, recipientName, onBack, onSend }) {
  if (!txn) {
    return (
      <View style={css.pageCenter}>
        <Text style={{ fontSize: 40, color: OK, marginBottom: 8 }}>✓</Text>
        <Text style={css.sectionTitle}>Malipo yametumwa!</Text>
        <Text style={css.mutedText}>Shughuli iko kwenye orodha yako.</Text>
        <View style={css.navRowLog}>
          <Pressable style={[css.btnGhost, { flex: 1 }]} onPress={onBack}><Text style={css.btnGhostText}>‹ Nyumbani</Text></Pressable>
          <Pressable style={[css.btnGold, { flex: 2 }]} onPress={onSend}><Text style={css.btnGoldText}>✈ Tuma nyingine</Text></Pressable>
        </View>
      </View>
    );
  }
  const st = clientStatus(txn.decision, txn.hold_status);
  const name = recipientName(txn.recipient_ref) || txn.recipient_ref || txn.recipient_external_ref || '';
  return (
    <ScrollView contentContainerStyle={css.page}>
      <View style={css.stepTop}>
        <Text style={css.stepNo}>✓</Text>
        <View>
          <Text style={css.stepTitle}>Malipo #{String(txn.transaction_id).slice(0, 8)}</Text>
          <Text style={css.stepSub}>hakiki ya malipo yako ya sasa</Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 14 }}>
        <View style={[css.badge, { backgroundColor: st.color + '22', borderColor: st.color }]}>
          <Text style={{ color: st.color, fontWeight: '700', fontSize: 13 }}>{justSent && st.color === DANGER ? st.label + ' — malipo hayakusafiri' : st.label}</Text>
        </View>
        <Text style={[css.heroBalance, { fontSize: 32, marginVertical: 10 }]}>{nf(txn.amount)}</Text>
        <Text style={css.mutedText}>Kwenda <Text style={{ color: TEXT, fontWeight: '700' }}>{name}</Text></Text>
      </View>

      <View style={css.detailBox}>
        {[
          ['Hali', st.label, st.color],
          ['Kiasi', Math.round(Number(txn.amount)).toLocaleString('en-TZ') + ' TZS', TEXT],
          ['Mpokeaji', name, TEXT],
          ['Namba ya mpokeaji', txn.recipient_ref || txn.recipient_external_ref, TEXT],
          ['Tarehe', fmtTime(txn.created_at), TEXT],
          ['Kumbukumbu', txn.transaction_reference || String(txn.transaction_id).slice(0, 16), TEXT],
        ].map(([k, v, c]) => (
          <View key={k} style={css.detailRow}>
            <Text style={css.detailKey}>{k}</Text>
            <Text style={{ color: c, flex: 1, textAlign: 'right', fontWeight: '600' }}>{v}</Text>
          </View>
        ))}
      </View>

      {st.label === 'Inakaguliwa' && (
        <View style={css.warnBox}>
          <Text style={{ color: WARN, lineHeight: 19 }}>⏳ Malipo yako yanakaguliwa kwa usalama. Utapata SMS ya kuthibitisha — kama hukupeleka wewe piga simu 100.</Text>
        </View>
      )}
      {st.label === 'Imekataliwa' && (
        <View style={css.warnBox}>
          <Text style={{ color: DANGER, lineHeight: 19 }}>🛡 Malipo yamekataliwa. Pesa zako hazikutoka nje ya akaunti. Kwa maelezo piga simu 100.</Text>
        </View>
      )}

      <View style={css.navRowLog}>
        <Pressable style={[css.btnGhost, { flex: 1 }]} onPress={onBack}><Text style={css.btnGhostText}>‹ Nyumbani</Text></Pressable>
        <Pressable style={[css.btnGold, { flex: 2 }]} onPress={onSend}><Text style={css.btnGoldText}>✈ Tuma nyingine</Text></Pressable>
      </View>
    </ScrollView>
  );
}

/* ---------------- NAV ---------------- */
function TabBtn({ icon, label, active, onPress }) {
  return (
    <Pressable style={[css.tab, active && css.tabOn]} onPress={onPress}>
      <Text style={{ fontSize: 17, opacity: active ? 1 : 0.55 }}>{icon}</Text>
      <Text style={[css.tabLabel, active && { color: GOLD }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- STYLES ---------------- */
const css = {
  header: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, borderBottomColor: LINE, borderBottomWidth: 1, backgroundColor: '#070b13', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: TEXT, fontWeight: '800', fontSize: 17 },
  headerSub: { color: GOLD, fontSize: 10, letterSpacing: 1.2, marginTop: 1 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarSmText: { color: '#06101f', fontWeight: '800', fontSize: 12 },
  pillLine: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10.5, fontWeight: '700' },
  page: { padding: 16, paddingBottom: 40, gap: 12 },
  pageCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  center: { alignItems: 'center', padding: 22, gap: 8 },
  mutedText: { color: MUTED, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  mutedNote: { color: MUTED, fontSize: 11.5, textAlign: 'center', lineHeight: 18, marginVertical: 8 },
  errorBox: { borderColor: DANGER + '66', borderWidth: 1, borderRadius: 12, margin: 16, padding: 16, gap: 10, backgroundColor: DANGER + '11' },
  errorText: { color: '#fda4af', fontSize: 13, lineHeight: 19 },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetSmall: { color: MUTED, fontSize: 12 },
  greet: { color: TEXT, fontWeight: '800', fontSize: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#06101f', fontWeight: '800', fontSize: 16 },
  hero: { backgroundColor: '#0d1526', borderColor: GOLD + '44', borderWidth: 1, borderRadius: 16, padding: 16, overflow: 'hidden' },
  heroLabel: { color: GOLD, fontSize: 10, letterSpacing: 2 },
  heroBalance: { color: TEXT, fontSize: 30, fontWeight: '800', marginTop: 6 },
  heroSub: { color: MUTED, fontSize: 11.5, marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  heroBtnText: { color: TEXT, fontSize: 12.5, fontWeight: '700' },
  featureRow: { flexDirection: 'row', gap: 8 },
  feature: { flex: 1, alignItems: 'center', gap: 3, backgroundColor: SURFACE, borderRadius: 12, borderColor: LINE, borderWidth: 1, paddingVertical: 12 },
  featureIco: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  featureName: { color: TEXT, fontWeight: '700', fontSize: 12.5 },
  featureSub: { color: MUTED, fontSize: 9.5 },
  switchRow: { gap: 8, marginTop: 4 },
  switchLabel: { color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  switchChip: { borderColor: LINE, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: SURFACE },
  switchChipOn: { backgroundColor: GOLD, borderColor: GOLD },
  switchChipText: { color: TEXT, fontSize: 12.5, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  sectionTitle: { color: TEXT, fontWeight: '800', fontSize: 15 },
  seeAll: { color: GOLD, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 12, padding: 12 },
  rowIco: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1 },
  rowTitle: { color: TEXT, fontWeight: '700', fontSize: 13.5 },
  rowSub: { color: MUTED, fontSize: 11, marginTop: 2 },
  rowAmt: { color: TEXT, fontWeight: '800', fontSize: 13.5 },
  rowTag: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  emptyState: { alignItems: 'center', gap: 8, backgroundColor: SURFACE, borderRadius: 12, borderColor: LINE, borderWidth: 1, padding: 18 },
  emptyIco: { fontSize: 26 },
  emptyTxt: { color: MUTED, fontSize: 12.5, textAlign: 'center' },
  btnGold: { backgroundColor: GOLD, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, flexDirection: 'row', gap: 6 },
  btnGoldText: { color: '#06101f', fontWeight: '800', fontSize: 14 },
  btnGhost: { borderColor: LINE, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, backgroundColor: SURFACE },
  btnGhostText: { color: TEXT, fontWeight: '700', fontSize: 13.5 },
  tabBar: { flexDirection: 'row', borderTopColor: LINE, borderTopWidth: 1, backgroundColor: '#070b13', paddingVertical: 6, paddingBottom: Platform.OS === 'ios' ? 18 : 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tabOn: {},
  tabLabel: { color: TEXT, fontSize: 10.5, fontWeight: '600', opacity: 0.7 },
  stepTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNo: { width: 30, height: 30, borderRadius: 15, backgroundColor: GOLD, color: '#06101f', textAlignVertical: 'center', textAlign: 'center', fontWeight: '800', overflow: 'hidden' },
  stepTitle: { color: TEXT, fontWeight: '800', fontSize: 16 },
  stepSub: { color: MUTED, fontSize: 11.5, marginTop: 1 },
  flowTop: { borderBottomColor: LINE, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#070b13' },
  flowBack: { alignSelf: 'flex-start' },
  flowBackTxt: { color: GOLD, fontWeight: '700', fontSize: 13 },
  flowNextTo: { color: MUTED, fontSize: 10.5, letterSpacing: 0.5, marginTop: 4 },
  input: { borderColor: LINE, borderWidth: 1, borderRadius: 10, backgroundColor: SURFACE, color: TEXT, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 12, padding: 12 },
  cAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cAvatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cName: { color: TEXT, fontWeight: '700', fontSize: 13.5 },
  cSub: { color: MUTED, fontSize: 11.5, marginTop: 1 },
  chev: { color: MUTED, fontSize: 16 },
  label: { color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickChip: { borderColor: LINE, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: SURFACE },
  quickChipOn: { backgroundColor: GOLD, borderColor: GOLD },
  quickChipText: { color: TEXT, fontSize: 12, fontWeight: '600' },
  transfer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 14, padding: 14 },
  tSide: { alignItems: 'center', flex: 1 },
  tAva: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tAvaText: { color: '#fff', fontWeight: '800' },
  tName: { color: TEXT, fontSize: 12, fontWeight: '700', marginTop: 6, maxWidth: 110 },
  tSub: { color: MUTED, fontSize: 9, letterSpacing: 0.8, marginTop: 3 },
  tMid: { paddingHorizontal: 6, alignItems: 'center', gap: 3 },
  tAmount: { color: COIN, fontWeight: '800', fontSize: 14 },
  tArrow: { color: MUTED, fontSize: 18 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 14 },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderColor: LINE, borderWidth: 2, backgroundColor: SURFACE },
  pinDotOn: { backgroundColor: GOLD, borderColor: GOLD },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  key: { width: '31%', aspectRatio: 1.6, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 12 },
  keyText: { color: TEXT, fontSize: 22, fontWeight: '700' },
  verifyBox: { backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  verifyLine: { color: MUTED, fontSize: 13, lineHeight: 19 },
  navRowLog: { flexDirection: 'row', gap: 10, marginTop: 18 },
  detailBox: { backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  detailKey: { color: MUTED, fontSize: 12.5 },
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  warnBox: { backgroundColor: WARN + '11', borderColor: WARN + '55', borderWidth: 1, borderRadius: 12, padding: 13 },
  profileCard: { alignItems: 'center', gap: 4, backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 16, padding: 20 },
  avatarLg: { width: 64, height: 64, borderRadius: 32, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarLgText: { color: '#06101f', fontWeight: '800', fontSize: 22 },
  profileName: { color: TEXT, fontWeight: '800', fontSize: 17 },
  profileSub: { color: GOLD, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderColor: LINE, borderWidth: 1, borderRadius: 12, padding: 14 },
  moreTitle: { color: TEXT, fontWeight: '700', fontSize: 13.5 },
  moreSub: { color: MUTED, fontSize: 11.5, marginTop: 1 },
  aboutBox: { backgroundColor: '#0d1526', borderColor: GOLD + '44', borderWidth: 1, borderRadius: 12, padding: 14 },
  aboutTitle: { color: TEXT, fontWeight: '800', fontSize: 13, marginBottom: 4 },
  aboutBody: { color: MUTED, fontSize: 12, lineHeight: 18 },
  versionTxt: { color: MUTED, fontSize: 10.5, textAlign: 'center', marginTop: 4 },
};