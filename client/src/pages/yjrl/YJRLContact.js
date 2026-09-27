import React from 'react';
import YJRLLayout from './YJRLLayout';
import ClubContacts from '../../components/ClubContacts';
import club from '../../../../shared/club.json';

export default function YJRLContact() {
  return <YJRLLayout><section className="yjrl-section"><div className="yjrl-section-inner">
    <div className="yjrl-section-header"><div className="yjrl-section-label">Here to help</div><h1 className="yjrl-section-title">Contact the club</h1><p>Choose the right contact for your enquiry.</p></div>
    <ClubContacts />
    <article className="yjrl-card club-info-card" style={{ marginTop: 24 }}><h2>Safety and welfare concerns</h2><p>Contact the Secretary at <a href="mailto:admin@yeppoonjrl.com.au">admin@yeppoonjrl.com.au</a> or the President at <a href={`mailto:${club.safety.email}`}>{club.safety.email}</a>.</p><p>President: <a href={`tel:${club.safety.tel}`}>{club.safety.phone}</a>. If a child is in immediate danger, call 000.</p></article>
    <p><a href={club.facebookUrl} target="_blank" rel="noopener noreferrer">Follow Yeppoon Junior Seagulls on Facebook</a></p>
  </div></section></YJRLLayout>;
}
