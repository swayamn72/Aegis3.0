/**
 * Valorant Agent Constants
 *
 * Static mapping of all 28 playable agents to their image URLs from valorant-api.com.
 * Used for immediate rendering while the dynamic API cache warms up.
 *
 * Image types:
 *   - icon: Small square icon (48×48) — for dropdowns, badges
 *   - bust: Chest-up portrait — for match result cards, player rows
 *   - killfeed: Small portrait — for kill feed display
 *   - full: Full body portrait — for featured displays
 */

// Agent UUID → image URL mapping from valorant-api.com
const AGENT_DATA = {
  Jett:      { uuid: 'add6443a-41bd-e414-f6ad-e58d267f4e95', role: 'Duelist' },
  Raze:      { uuid: 'f94c3b30-42be-e959-889c-5aa313dba261', role: 'Duelist' },
  Reyna:     { uuid: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc', role: 'Duelist' },
  Phoenix:   { uuid: 'eb93336a-449b-9c1b-0a54-a891f7921d69', role: 'Duelist' },
  Neon:      { uuid: 'bb2a4828-46eb-8cd1-e765-15848195d751', role: 'Duelist' },
  Yoru:      { uuid: '7f94d92c-4234-0a36-9646-3a87eb8b5c89', role: 'Duelist' },
  Iso:       { uuid: '0e38b510-41a8-5780-5e8f-568b2a4f2d6c', role: 'Duelist' },
  Waylay:    { uuid: 'df1cb487-4902-002e-5c17-d28e83e78588', role: 'Duelist' },
  Sova:      { uuid: '320b2a48-4d9b-a075-30f1-1f93a9b638fa', role: 'Initiator' },
  Breach:    { uuid: '5f8d3a7f-467b-97f3-062c-13acf203c006', role: 'Initiator' },
  Skye:      { uuid: '6f2a04ca-43e0-be17-7f36-b3908627744d', role: 'Initiator' },
  'KAY/O':   { uuid: '601dbbe7-43ce-be57-2a40-4abd24953621', role: 'Initiator' },
  Fade:      { uuid: 'dade69b4-4f5a-8528-247b-219e5a1facd6', role: 'Initiator' },
  Gekko:     { uuid: 'e370fa57-4757-3604-3648-499e1f642d3f', role: 'Initiator' },
  Tejo:      { uuid: 'b444168c-4e35-8076-db47-ef9bf368f384', role: 'Initiator' },
  Brimstone: { uuid: '9f0d8ba9-4140-b941-57d3-a7ad57c6b417', role: 'Controller' },
  Omen:      { uuid: '8e253930-4c05-31dd-1b6c-968525494517', role: 'Controller' },
  Astra:     { uuid: '41fb69c1-4189-7b37-f117-bcaf1e96f1bf', role: 'Controller' },
  Viper:     { uuid: '707eab51-4836-f488-046a-cda6bf494859', role: 'Controller' },
  Harbor:    { uuid: '95b78ed7-4637-86d9-7e41-71ba8c293152', role: 'Controller' },
  Clove:     { uuid: '1dbf2edd-4729-0984-3115-daa5eed44993', role: 'Controller' },
  Miks:      { uuid: '7c8a4701-4de6-9355-b254-e09bc2a34b72', role: 'Controller' },
  Sage:      { uuid: '569fdd95-4d10-43ab-ca70-79becc718b46', role: 'Sentinel' },
  Cypher:    { uuid: '117ed9e3-49f3-6512-3ccf-0cada7e3823b', role: 'Sentinel' },
  Killjoy:   { uuid: '1e58de9c-4950-5125-93e9-a0aee9f98746', role: 'Sentinel' },
  Chamber:   { uuid: '22697a3d-45bf-8dd7-4fec-84a9e28c69d7', role: 'Sentinel' },
  Deadlock:  { uuid: 'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235', role: 'Sentinel' },
  Vyse:      { uuid: 'efba5359-4016-a1e5-7626-b1ae76895940', role: 'Sentinel' },
  Veto:      { uuid: '92eeef5d-43b5-1d4a-8d03-b3927a09034b', role: 'Sentinel' },
};

const BASE_URL = 'https://media.valorant-api.com/agents';

/**
 * Get all image URLs for an agent.
 * @param {string} agentName — e.g., 'Jett', 'KAY/O'
 * @returns {{ icon: string, bust: string, killfeed: string, full: string } | null}
 */
export function getAgentImages(agentName) {
  const data = AGENT_DATA[agentName];
  if (!data) return null;

  return {
    icon: `${BASE_URL}/${data.uuid}/displayicon.png`,
    bust: `${BASE_URL}/${data.uuid}/fullportrait.png`,
    killfeed: `${BASE_URL}/${data.uuid}/killfeedportrait.png`,
    full: `${BASE_URL}/${data.uuid}/fullportrait.png`,
    background: `${BASE_URL}/${data.uuid}/background.png`,
  };
}

/**
 * Get the role for an agent.
 */
export function getAgentRole(agentName) {
  return AGENT_DATA[agentName]?.role || null;
}

/**
 * Get all agents grouped by role.
 */
export function getAgentsByRole() {
  const groups = {};
  for (const [name, data] of Object.entries(AGENT_DATA)) {
    if (!groups[data.role]) groups[data.role] = [];
    groups[data.role].push({ name, ...data, images: getAgentImages(name) });
  }
  return groups;
}

/**
 * Get all agent names.
 */
export function getAllAgentNames() {
  return Object.keys(AGENT_DATA);
}

/**
 * Full agent list with images for dropdown/selectors.
 */
export const AGENT_LIST = Object.entries(AGENT_DATA).map(([name, data]) => ({
  name,
  role: data.role,
  uuid: data.uuid,
  images: getAgentImages(name),
}));

// Role-specific icons from valorant-api.com
export const ROLE_ICONS = {
  Duelist: 'https://media.valorant-api.com/agents/roles/dbe8757e-9e92-4ed4-b39f-9dfc589691d4/displayicon.png',
  Initiator: 'https://media.valorant-api.com/agents/roles/1b47567f-8f7b-444b-aae3-b0c634622d10/displayicon.png',
  Controller: 'https://media.valorant-api.com/agents/roles/4ee40330-ecdd-4f2f-98a8-eb1243428373/displayicon.png',
  Sentinel: 'https://media.valorant-api.com/agents/roles/5fc02f99-4091-4486-a531-98459a3e95e9/displayicon.png',
};

export default AGENT_DATA;
