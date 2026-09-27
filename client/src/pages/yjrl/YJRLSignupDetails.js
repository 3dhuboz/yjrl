import React from 'react';
import { Link } from 'react-router-dom';
import YJRLLayout from './YJRLLayout';
import ClubContacts from '../../components/ClubContacts';
import club from '../../../../shared/club.json';
import season from '../../../../shared/season.json';

export default function YJRLSignupDetails() {
  return <YJRLLayout><section className="yjrl-section"><div className="yjrl-section-inner" style={{ maxWidth: 960 }}>
    <div className="yjrl-section-header"><div className="yjrl-section-label">Mini Mods to U17 boys and girls</div><h1 className="yjrl-section-title">{season.season} registration details</h1></div>
    <article className="yjrl-card club-info-card"><h2>Register through Play Rugby League</h2><p>Player registrations and registration payments are handled through Play Rugby League (MySideline). You do not need to submit a second player registration or pay registration fees on this website.</p>
      <p>{club.registrationNotice}</p><p>The club will confirm fees, inclusions and the direct 2027 registration link before registrations open. On Play Rugby League, look for Yeppoon Seagulls Junior Rugby League and check the season before registering.</p>
      <a className="yjrl-btn yjrl-btn-primary" href={club.registrationUrl} target="_blank" rel="noopener noreferrer">Visit Play Rugby League</a>
    </article>
    <h2 style={{ marginTop: 28 }}>Registration enquiries</h2><ClubContacts registrationOnly />
    <article className="yjrl-card club-info-card" style={{ marginTop: 24 }}><h2>Club website accounts</h2><p>Website accounts are for adults aged 18 or older. Parents and guardians manage children’s club information when member access opens. A website account is separate from your official player registration.</p><Link to="/contact">Contact the club for help</Link></article>
  </div></section></YJRLLayout>;
}
