import DeviceLinkQr from './DeviceLinkQr';
import { inviteWebUrl } from '../lib/inviteLink';

export default function InviteQr({ username, baseUrl, label = 'Scan to add me on SSC' }) {
  const url = username ? inviteWebUrl(username, baseUrl) : null;
  return <DeviceLinkQr url={url} label={label} />;
}