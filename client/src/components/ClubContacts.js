import React from 'react';
import club from '../../../shared/club.json';

export default function ClubContacts({ registrationOnly = false }) {
  const contacts = registrationOnly ? club.contacts.filter(c => ['mini', 'international', 'girls'].includes(c.id)) : club.contacts;
  return <div className="club-contact-grid">{contacts.map(contact => <article className="yjrl-card club-info-card" key={contact.id}>
    <h2>{contact.label}</h2><a href={`mailto:${contact.email}`}>{contact.email}</a>
  </article>)}</div>;
}
