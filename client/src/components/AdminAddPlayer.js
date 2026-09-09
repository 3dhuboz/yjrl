import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import season from '../../../shared/season.json';

const EMPTY = { firstName: '', lastName: '', dateOfBirth: '', ageGroup: 'U14', teamId: '', guardianName: '', guardianEmail: '', guardianPhone: '', emergency_name: '', emergency_phone: '', emergency_relationship: '', medicalNotes: '', registrationYear: season.season, registrationStatus: 'pending' };
export default function AdminAddPlayer({ teams, onCreated }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api.post('/yjrl/players', form);
      // The successful create is authoritative even if the subsequent list refresh fails.
      onCreated({ ...form, _id: result.data._id, id: result.data.id });
      setForm(null); toast.success('Player added — pending registration review');
    } catch (e) { setError(e.response?.data?.error || 'Could not save player.'); }
    finally { setBusy(false); }
  };
  return <div className="admin-toolbar"><Link className="yjrl-btn yjrl-btn-secondary" to="/register">Public registration page</Link><button className="yjrl-btn yjrl-btn-primary" onClick={() => { setError(''); setForm({ ...EMPTY }); }}><Plus size={16} /> Add Player</button>
    {form && <div className="yjrl-modal-overlay"><form className="yjrl-modal" onSubmit={save}>
      <div className="yjrl-modal-header"><h2 className="yjrl-modal-title">Add Player</h2><button type="button" className="yjrl-btn yjrl-btn-secondary" aria-label="Close player form" onClick={() => setForm(null)}><X size={18} /></button></div>
      <div className="yjrl-modal-body"><p>Add a player from the club’s records. The record will be pending review. This does not create a login, record a payment or grant photo consent.</p>
        {error && <p className="yjrl-form-error" role="alert">{error}</p>}
        <div className="admin-form-grid">
          {[['First name', 'firstName', 'text', true], ['Last name', 'lastName', 'text', true], ['Date of birth', 'dateOfBirth', 'date', true], ['Guardian name', 'guardianName', 'text', true], ['Guardian email', 'guardianEmail', 'email', true], ['Guardian phone', 'guardianPhone', 'tel', true], ['Emergency contact name', 'emergency_name', 'text', false], ['Emergency phone', 'emergency_phone', 'tel', false], ['Emergency relationship', 'emergency_relationship', 'text', false]].map(([label, key, type, required]) => <label key={key}>{label}{required ? ' *' : ''}<input aria-label={label} type={type} required={required} maxLength={254} max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined} className="yjrl-input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
          <label>Age group<select aria-label="Player age group" className="yjrl-input" value={form.ageGroup} onChange={e => setForm({ ...form, ageGroup: e.target.value })}>{['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens', 'Mens'].map(age => <option key={age}>{age}</option>)}</select></label>
          <label>Team<select aria-label="Player team" className="yjrl-input" value={form.teamId} onChange={e => setForm({ ...form, teamId: e.target.value })}><option value="">Unassigned</option>{teams.map(team => <option key={team._id} value={team._id}>{team.name} ({team.ageGroup})</option>)}</select></label>
        </div>
        <label className="yjrl-label" htmlFor="player-medical">Medical notes (optional)</label><textarea id="player-medical" className="yjrl-input" rows={3} maxLength={2000} value={form.medicalNotes} onChange={e => setForm({ ...form, medicalNotes: e.target.value })} />
      </div><div className="yjrl-modal-footer"><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setForm(null)}>Cancel</button><button className="yjrl-btn yjrl-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add Player'}</button></div>
    </form></div>}
  </div>;
}
