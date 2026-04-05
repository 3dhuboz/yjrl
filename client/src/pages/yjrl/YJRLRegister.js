import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ChevronRight, ArrowLeft, User, Users, MapPin, Calendar } from 'lucide-react';
import YJRLLayout from './YJRLLayout';
import api from '../../api';
import toast from 'react-hot-toast';
import './yjrl.css';

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens', 'Mens'];
const POSITIONS = ['Not Sure Yet', 'Fullback', 'Wing', 'Centre', 'Five-Eighth', 'Halfback', 'Hooker', 'Prop', 'Lock', 'Second-Row'];

const STEPS = [
  { id: 1, label: 'Player Details' },
  { id: 2, label: 'Guardian / Family' },
  { id: 3, label: 'Medical & Emergency' },
  { id: 4, label: 'Confirmation' },
];

const EARLY_BIRD_DISCOUNT = 20;

const YJRLRegister = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', ageGroup: '', position: 'Not Sure Yet',
    guardianName: '', guardianPhone: '', guardianEmail: '',
    emergencyName: '', emergencyPhone: '', emergencyRelationship: '',
    medicalNotes: '', agreeToTerms: false, agreeToPhotoPolicy: false
  });
  const [submitted, setSubmitted] = useState(false);
  const [fees, setFees] = useState({});
  const [earlyBirdActive, setEarlyBirdActive] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paypal');
  const [submitting, setSubmitting] = useState(false);

  // Load registration fees from API
  useEffect(() => {
    api.get('/registration-fees').then(res => {
      setFees(res.data.fees);
      setEarlyBirdActive(res.data.earlyBirdActive);
    }).catch(() => {});
  }, []);

  // Handle PayPal return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regId = params.get('reg');
    const success = params.get('success');
    if (success === 'true' && regId) {
      api.post(`/register-player/${regId}/capture`).then(res => {
        if (res.data.token) localStorage.setItem('yjrl_token', res.data.token);
        setStep(5); // success
        toast.success('Payment confirmed! Welcome to the Seagulls!');
      }).catch(() => toast.error('Payment capture failed. Please contact the club.'));
    }
  }, []);

  const isEarlyBird = earlyBirdActive;
  const fee = form.ageGroup ? fees[form.ageGroup] || 140 : null;
  const finalFee = fee && isEarlyBird ? fee - EARLY_BIRD_DISCOUNT : fee;

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const nextStep = () => {
    if (step === 1 && (!form.firstName || !form.lastName || !form.dateOfBirth || !form.ageGroup)) {
      toast.error('Please complete all required fields'); return;
    }
    if (step === 2 && (!form.guardianName || !form.guardianPhone || !form.guardianEmail)) {
      toast.error('Please complete all guardian details'); return;
    }
    if (step === 3 && (!form.emergencyName || !form.emergencyPhone)) {
      toast.error('Please provide emergency contact details'); return;
    }
    setStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!form.agreeToTerms) { toast.error('Please agree to the terms and conditions'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/register-player', {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        ageGroup: form.ageGroup,
        position: form.position,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        guardianEmail: form.guardianEmail,
        emergencyName: form.emergencyName,
        emergencyPhone: form.emergencyPhone,
        emergencyRelationship: form.emergencyRelationship,
        medicalNotes: form.medicalNotes,
        agreeToTerms: form.agreeToTerms,
        agreeToPhotoPolicy: form.agreeToPhotoPolicy,
        paymentMethod: selectedPaymentMethod
      });
      if (res.data.approvalUrl) {
        // Redirect to PayPal
        window.location.href = res.data.approvalUrl;
      } else {
        // Offline payment - show success
        if (res.data.token) localStorage.setItem('yjrl_token', res.data.token);
        setStep(5); // success step
        toast.success('Registration submitted!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted || step === 5) return (
    <YJRLLayout>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🏉</div>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#4ade80' }}>
          <CheckCircle size={36} />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.75rem', color: '#4ade80' }}>
          Registration Submitted!
        </h1>
        <p style={{ color: 'var(--yjrl-muted)', lineHeight: 1.7, fontSize: '1rem', marginBottom: '2rem' }}>
          Welcome to the Yeppoon Seagulls, <strong style={{ color: 'var(--yjrl-text)' }}>{form.firstName}</strong>!
          Your registration has been received and a confirmation email will be sent to <strong style={{ color: 'var(--yjrl-text)' }}>{form.guardianEmail}</strong>.
        </p>
        <div style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
          <h3 style={{ color: 'var(--yjrl-gold)', fontWeight: 800, margin: '0 0 1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next Steps</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              'Our registrar will review your application within 48 hours',
              'You will receive a confirmation email with payment details',
              `Complete payment of $${finalFee} to finalise your registration`,
              'Your child will be assigned to a team and training schedule',
              'Welcome pack including uniform details will be sent to you'
            ].map((step, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--yjrl-muted)' }}>
                <span style={{ color: 'var(--yjrl-gold)', fontWeight: 800, minWidth: 18 }}>{i + 1}.</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="yjrl-btn yjrl-btn-primary">Back to Home</Link>
          <Link to="/portal/parent" className="yjrl-btn yjrl-btn-secondary">Go to Parent Portal</Link>
        </div>
      </div>
    </YJRLLayout>
  );

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem', color: 'white' }}>
            Join the Club
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: 0 }}>
            Register for the {new Date().getFullYear()} Yeppoon Junior Rugby League season.
          </p>

          {isEarlyBird && (
            <div style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.25)', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--yjrl-gold)', fontWeight: 600 }}>
              🎉 Early Bird Discount Active — Save ${EARLY_BIRD_DISCOUNT} on registration!
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 900, flexShrink: 0,
                  background: step > s.id ? '#4ade80' : step === s.id ? 'var(--yjrl-gold)' : 'rgba(255,255,255,0.1)',
                  color: step > s.id ? 'white' : step === s.id ? 'var(--yjrl-navy)' : 'var(--yjrl-muted)'
                }}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: step === s.id ? 700 : 400, color: step === s.id ? 'var(--yjrl-text)' : 'var(--yjrl-muted)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ height: 1, background: step > s.id + 1 ? '#4ade80' : 'rgba(255,255,255,0.1)', flex: 1, minWidth: 20 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="yjrl-card">
          <div className="yjrl-card-header">
            <div className="yjrl-card-title">Step {step}: {STEPS[step - 1].label}</div>
            {form.ageGroup && fee && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--yjrl-gold)' }}>
                  ${finalFee}
                </div>
                {isEarlyBird && (
                  <div style={{ fontSize: '0.7rem', color: '#4ade80', textDecoration: 'line-through' }}>${fee} (${EARLY_BIRD_DISCOUNT} off)</div>
                )}
              </div>
            )}
          </div>

          <div className="yjrl-card-body">
            {/* ── Step 1: Player ── */}
            {step === 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[['First Name', 'firstName', 'text', true], ['Last Name', 'lastName', 'text', true]].map(([label, key, type, required]) => (
                  <div key={key} className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">{label} {required && <span style={{ color: 'var(--yjrl-red)' }}>*</span>}</label>
                    <input type={type} className="yjrl-input" value={form[key]} onChange={e => update(key, e.target.value)} placeholder={label} />
                  </div>
                ))}
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Date of Birth <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <input type="date" className="yjrl-input" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Age Group <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <select className="yjrl-input" value={form.ageGroup} onChange={e => update('ageGroup', e.target.value)}>
                    <option value="">— Select Age Group —</option>
                    {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                  {form.ageGroup && fee && (
                    <div style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '0.4rem' }}>
                      Registration fee: ${isEarlyBird ? finalFee : fee} {isEarlyBird && `(early bird -$${EARLY_BIRD_DISCOUNT})`}
                    </div>
                  )}
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                  <label className="yjrl-label">Preferred Position</label>
                  <select className="yjrl-input" value={form.position} onChange={e => update('position', e.target.value)}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* ── Step 2: Guardian ── */}
            {step === 2 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                  <label className="yjrl-label">Guardian / Parent Name <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <input type="text" className="yjrl-input" value={form.guardianName} onChange={e => update('guardianName', e.target.value)} placeholder="Full name" />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Phone Number <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <input type="tel" className="yjrl-input" value={form.guardianPhone} onChange={e => update('guardianPhone', e.target.value)} placeholder="04XX XXX XXX" />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Email Address <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <input type="email" className="yjrl-input" value={form.guardianEmail} onChange={e => update('guardianEmail', e.target.value)} placeholder="your@email.com" />
                </div>
                <div style={{ gridColumn: 'span 2', background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '0.875rem 1rem', fontSize: '0.85rem', color: 'var(--yjrl-muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: '#60a5fa' }}>Privacy Notice:</strong> Your personal information is collected solely for club registration, communication, and compliance purposes. We do not share your information with third parties without your consent.
                </div>
              </div>
            )}

            {/* ── Step 3: Medical ── */}
            {step === 3 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Emergency Contact Name <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <input type="text" className="yjrl-input" value={form.emergencyName} onChange={e => update('emergencyName', e.target.value)} placeholder="Full name" />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Emergency Contact Phone <span style={{ color: 'var(--yjrl-red)' }}>*</span></label>
                  <input type="tel" className="yjrl-input" value={form.emergencyPhone} onChange={e => update('emergencyPhone', e.target.value)} placeholder="04XX XXX XXX" />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Relationship to Player</label>
                  <input type="text" className="yjrl-input" value={form.emergencyRelationship} onChange={e => update('emergencyRelationship', e.target.value)} placeholder="e.g. Mother, Father, Grandparent" />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                  <label className="yjrl-label">Medical Notes / Conditions</label>
                  <textarea
                    className="yjrl-input"
                    rows={3}
                    style={{ resize: 'vertical' }}
                    value={form.medicalNotes}
                    onChange={e => update('medicalNotes', e.target.value)}
                    placeholder="Any allergies, medical conditions, medications, or special requirements the coach and first aider should be aware of. Leave blank if none."
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Confirmation ── */}
            {step === 4 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--yjrl-gold)', marginBottom: '0.75rem' }}>Player</div>
                    {[['Name', `${form.firstName} ${form.lastName}`], ['DOB', form.dateOfBirth], ['Age Group', form.ageGroup], ['Position', form.position]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--yjrl-muted)' }}>{l}</span>
                        <span style={{ fontWeight: 600 }}>{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--yjrl-gold)', marginBottom: '0.75rem' }}>Guardian</div>
                    {[['Name', form.guardianName], ['Phone', form.guardianPhone], ['Email', form.guardianEmail]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.875rem' }}>
                        <span style={{ color: 'var(--yjrl-muted)' }}>{l}</span>
                        <span style={{ fontWeight: 600 }}>{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {form.ageGroup && (
                  <div style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.25)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Registration Fee — {form.ageGroup}</div>
                      {isEarlyBird && <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>Early bird discount applied (-${EARLY_BIRD_DISCOUNT})</div>}
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--yjrl-gold)' }}>${finalFee}</div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--yjrl-gold)', marginBottom: '0.75rem' }}>Payment Method</div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <label style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                      padding: '1rem', borderRadius: '10px',
                      border: selectedPaymentMethod === 'paypal' ? '2px solid var(--yjrl-gold)' : '1px solid var(--yjrl-border)',
                      background: selectedPaymentMethod === 'paypal' ? 'rgba(240,165,0,0.06)' : 'transparent'
                    }}>
                      <input type="radio" name="paymentMethod" value="paypal" checked={selectedPaymentMethod === 'paypal'} onChange={() => setSelectedPaymentMethod('paypal')} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>PayPal</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>Pay securely online now</div>
                      </div>
                    </label>
                    <label style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                      padding: '1rem', borderRadius: '10px',
                      border: selectedPaymentMethod === 'offline' ? '2px solid var(--yjrl-gold)' : '1px solid var(--yjrl-border)',
                      background: selectedPaymentMethod === 'offline' ? 'rgba(240,165,0,0.06)' : 'transparent'
                    }}>
                      <input type="radio" name="paymentMethod" value="offline" checked={selectedPaymentMethod === 'offline'} onChange={() => setSelectedPaymentMethod('offline')} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Bank Transfer / Offline</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>Pay via bank transfer or at the club</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--yjrl-muted)', lineHeight: 1.5 }}>
                    <input type="checkbox" style={{ marginTop: '0.15rem', flexShrink: 0 }} checked={form.agreeToTerms} onChange={e => update('agreeToTerms', e.target.checked)} />
                    I agree to the Yeppoon Junior Rugby League Terms and Conditions, including the Code of Conduct for Players, Parents, and Spectators. <span style={{ color: 'var(--yjrl-red)' }}>*</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--yjrl-muted)', lineHeight: 1.5 }}>
                    <input type="checkbox" style={{ marginTop: '0.15rem', flexShrink: 0 }} checked={form.agreeToPhotoPolicy} onChange={e => update('agreeToPhotoPolicy', e.target.checked)} />
                    I consent to my child being photographed and filmed during club activities for use in club communications and social media.
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--yjrl-border)', display: 'flex', justifyContent: 'space-between' }}>
            {step > 1 ? (
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setStep(prev => prev - 1)}>
                <ArrowLeft size={15} /> Back
              </button>
            ) : <div />}
            {step < 4 ? (
              <button className="yjrl-btn yjrl-btn-primary" onClick={nextStep}>
                Next <ChevronRight size={15} />
              </button>
            ) : (
              <button className="yjrl-btn yjrl-btn-primary" onClick={handleSubmit} disabled={!form.agreeToTerms || submitting}>
                <CheckCircle size={15} /> {submitting ? 'Submitting...' : 'Submit Registration'}
              </button>
            )}
          </div>
        </div>

        {/* PlayHQ CTA */}
        <div style={{ marginTop: '1.5rem', background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '10px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem', color: '#60a5fa' }}>Already registered via PlayHQ?</div>
            <div style={{ fontSize: '0.825rem', color: 'var(--yjrl-muted)' }}>If you've already completed your registration through PlayHQ, you don't need to fill this form. Contact the club to get your player portal activated.</div>
          </div>
          <a href="mailto:info@yepponjrl.com.au" className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm">Contact Club</a>
        </div>
      </div>
    </YJRLLayout>
  );
};

export default YJRLRegister;
