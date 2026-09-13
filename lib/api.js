async function j(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  savePerson: (device_id, name, personal_pin) =>
    fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, name, personal_pin }),
    }).then(j),

  getMyInfo: (device_id) =>
    fetch(`/api/people?device_id=${encodeURIComponent(device_id)}`).then(j),

  reconnectPerson: (name, personal_pin) =>
    fetch("/api/people/reconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, personal_pin }),
    }).then(j),

  getProgress: (device_id) =>
    fetch(`/api/progress?device_id=${encodeURIComponent(device_id)}`).then(j),

  saveProgress: (device_id, day, p, r, m) =>
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, day, p, r, m }),
    }).then(j),

  getJournal: (device_id) =>
    fetch(`/api/journal?device_id=${encodeURIComponent(device_id)}`).then(j),

  saveJournal: (device_id, day, text) =>
    fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, day, text }),
    }).then(j),

  getEvents: () => fetch("/api/events").then(j),

  createEvent: (event) =>
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).then(j),

  updateEvent: (id, event) =>
    fetch("/api/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...event }),
    }).then(j),

  deleteEvent: (id) => fetch(`/api/events?id=${id}`, { method: "DELETE" }).then(j),

  rsvpEvent: (eventId, device_id, name, status) =>
    fetch(`/api/events/${eventId}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, name, status }),
    }).then(j),

  getPrayer: (device_id) =>
    fetch(`/api/prayer${device_id ? `?device_id=${encodeURIComponent(device_id)}` : ""}`).then(j),

  createPrayer: (device_id, name, text, anonymous) =>
    fetch("/api/prayer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, name, text, anonymous }),
    }).then(j),

  updatePrayer: (id, device_id, name, text, anonymous) =>
    fetch(`/api/prayer/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, name, text, anonymous }),
    }).then(j),

  deletePrayer: (id, device_id) =>
    fetch(`/api/prayer/${id}?device_id=${encodeURIComponent(device_id)}`, {
      method: "DELETE",
    }).then(j),

  prayFor: (id, device_id) =>
    fetch(`/api/prayer/${id}/pray`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id }),
    }).then(j),

  getAnnouncements: () => fetch("/api/announcements").then(j),
  createAnnouncement: (title, body) =>
    fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    }).then(j),
  updateAnnouncement: (id, title, body) =>
    fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title, body }),
    }).then(j),
  deleteAnnouncement: (id) => fetch(`/api/announcements?id=${id}`, { method: "DELETE" }).then(j),

  getClassNotes: () => fetch("/api/class-notes").then(j),
  createClassNote: (title, body) =>
    fetch("/api/class-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    }).then(j),
  updateClassNote: (id, title, body) =>
    fetch("/api/class-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title, body }),
    }).then(j),
  deleteClassNote: (id) => fetch(`/api/class-notes?id=${id}`, { method: "DELETE" }).then(j),

  getDiscussions: (device_id) =>
    fetch(`/api/discussions${device_id ? `?device_id=${encodeURIComponent(device_id)}` : ""}`).then(j),
  createDiscussion: (title, body) =>
    fetch("/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    }).then(j),
  updateDiscussion: (id, title, body) =>
    fetch("/api/discussions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title, body }),
    }).then(j),
  deleteDiscussion: (id) => fetch(`/api/discussions?id=${id}`, { method: "DELETE" }).then(j),

  addDiscussionReply: (discussionId, device_id, name, text) =>
    fetch(`/api/discussions/${discussionId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id, name, text }),
    }).then(j),
  deleteDiscussionReply: (discussionId, replyId, device_id) =>
    fetch(
      `/api/discussions/${discussionId}/replies?reply_id=${replyId}&device_id=${encodeURIComponent(device_id)}`,
      { method: "DELETE" }
    ).then(j),

  getRoster: () => fetch("/api/roster").then(j),
  removeFromRoster: (device_id) =>
    fetch(`/api/roster?device_id=${encodeURIComponent(device_id)}`, { method: "DELETE" }).then(j),

  verifyLeaderPin: (pin) =>
    fetch("/api/leader/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).then(j),

  leaderStatus: () => fetch("/api/leader/verify").then(j),
  leaderSignOut: () => fetch("/api/leader/verify", { method: "DELETE" }).then(j),

  getNotifications: (device_id) =>
    fetch(`/api/notifications${device_id ? `?device_id=${encodeURIComponent(device_id)}` : ""}`).then(j),
  markNotificationsSeen: (device_id) =>
    fetch("/api/notifications/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id }),
    }).then(j),

  getPassage: (book, chapter) => fetch(`/api/bible/passage?book=${book}&chapter=${chapter}`).then(j),
  getLexiconEntry: (id) => fetch(`/api/bible/lexicon?id=${encodeURIComponent(id)}`).then(j),
  getCommentary: (book, chapter) =>
    fetch(`/api/bible/commentary?book=${book}&chapter=${chapter}`).then(j),
  getCrossRefs: (book, chapter, verse) =>
    fetch(`/api/bible/crossrefs?book=${book}&chapter=${chapter}&verse=${verse}`).then(j),
  searchDictionary: (q) => fetch(`/api/bible/dictionary?q=${encodeURIComponent(q)}`).then(j),
  getDictionaryEntry: (word) => fetch(`/api/bible/dictionary?word=${encodeURIComponent(word)}`).then(j),
  getChapterCounts: () => fetch(`/api/bible/chapter-counts`).then(j),
  getGlossary: () => fetch(`/api/bible/glossary`).then(j),
  getBeliefs: () => fetch(`/api/bible/beliefs`).then(j),
  browseDictionary: (source, letter) => fetch(`/api/bible/browse?source=${source}&letter=${letter}`).then(j),
  wordLookup: (word) => fetch(`/api/bible/word-lookup?word=${encodeURIComponent(word)}`).then(j),

  getHighlights: (deviceId, book, chapter) =>
    fetch(
      book && chapter
        ? `/api/bible/highlights?device_id=${deviceId}&book=${book}&chapter=${chapter}`
        : `/api/bible/highlights?device_id=${deviceId}`
    ).then(j),
  addHighlight: (payload) =>
    fetch("/api/bible/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(j),
  removeHighlight: (id, deviceId) =>
    fetch(`/api/bible/highlights?id=${id}&device_id=${deviceId}`, { method: "DELETE" }).then(j),

  getNotes: (deviceId, book, chapter) =>
    fetch(
      book && chapter
        ? `/api/bible/notes?device_id=${deviceId}&book=${book}&chapter=${chapter}`
        : `/api/bible/notes?device_id=${deviceId}`
    ).then(j),
  saveNote: (payload) =>
    fetch("/api/bible/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(j),
  removeNote: (id, deviceId) =>
    fetch(`/api/bible/notes?id=${id}&device_id=${deviceId}`, { method: "DELETE" }).then(j),

  getTags: (deviceId, book, chapter) =>
    fetch(
      book && chapter
        ? `/api/bible/tags?device_id=${deviceId}&book=${book}&chapter=${chapter}`
        : `/api/bible/tags?device_id=${deviceId}`
    ).then(j),
  addTag: (payload) =>
    fetch("/api/bible/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(j),
  removeTag: (id, deviceId) =>
    fetch(`/api/bible/tags?id=${id}&device_id=${deviceId}`, { method: "DELETE" }).then(j),
};
