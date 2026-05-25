import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, FileText, HeartHandshake } from 'lucide-react';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const PAGES = {
  privacy: {
    icon: Shield,
    title: 'Privacy Policy',
    intro: 'How Yeppoon Junior Rugby League handles member and family information.',
    sections: [
      ['Information we collect', 'We collect registration, guardian contact, emergency contact, medical, payment status, team, attendance, and club communication details needed to operate junior rugby league safely.'],
      ['How it is used', 'Information is used for registrations, team management, safety planning, club communication, payment follow-up, and lawful administration of club activities.'],
      ['Sharing', 'Information is shared only where required for club operations, competition administration, safety, payment processing, or legal compliance. We do not sell member information.'],
      ['Access and corrections', 'Parents, guardians, and members can request access to their information or ask for corrections by contacting the club registrar.']
    ]
  },
  terms: {
    icon: FileText,
    title: 'Terms of Use',
    intro: 'The expectations for using the Yeppoon Junior Rugby League website and member portals.',
    sections: [
      ['Accounts', 'Portal access is for registered players, parents, coaches, and authorised club administrators. Keep login details secure and notify the club if access should be removed.'],
      ['Registration', 'Registration details must be accurate and kept current. Player participation remains subject to club review, competition requirements, and payment completion.'],
      ['Payments', 'Online payments are processed by third-party payment providers. Offline payment instructions are issued by the club after registration review.'],
      ['Acceptable use', 'Members must not misuse club systems, attempt unauthorised access, upload harmful content, or use communication tools for bullying, abuse, or harassment.']
    ]
  },
  'child-safety': {
    icon: HeartHandshake,
    title: 'Child Safety',
    intro: 'Safeguarding expectations for players, families, coaches, volunteers, and administrators.',
    sections: [
      ['Safe communication', 'Player and parent chat areas are access controlled. Junior player communication is time limited and moderated for inappropriate language.'],
      ['Medical and emergency details', 'Medical and emergency contact information is collected so coaches and first aiders can respond appropriately during club activities.'],
      ['Photography', 'Parents and guardians can choose whether to consent to club photography and filming during registration.'],
      ['Concerns', 'Any safety, welfare, or conduct concern should be raised promptly with a coach, team manager, registrar, or club executive.']
    ]
  }
};

const YJRLLegal = () => {
  const { page = 'privacy' } = useParams();
  const content = PAGES[page] || PAGES.privacy;
  const Icon = content.icon;

  return (
    <YJRLLayout>
      <section style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.9rem' }}>Back to club home</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase' }}>{content.title}</h1>
              <p style={{ margin: '0.5rem 0 0', color: 'rgba(255,255,255,0.78)', maxWidth: 680 }}>{content.intro}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="yjrl-section">
        <div className="yjrl-section-inner" style={{ maxWidth: 960 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {content.sections.map(([title, detail]) => (
              <article key={title} className="yjrl-card" style={{ padding: '1.5rem' }}>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800 }}>{title}</h2>
                <p style={{ margin: 0, color: 'var(--yjrl-muted)', lineHeight: 1.7 }}>{detail}</p>
              </article>
            ))}
          </div>

          <div style={{ marginTop: '2rem', padding: '1.25rem', background: '#f8fafc', border: '1px solid var(--yjrl-border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--yjrl-muted)' }}>Questions or corrections?</span>
            <a href="mailto:yeppoonjrl@outlook.com" className="yjrl-btn yjrl-btn-primary">Contact the Club</a>
          </div>
        </div>
      </section>
    </YJRLLayout>
  );
};

export default YJRLLegal;
