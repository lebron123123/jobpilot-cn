const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..'), storeFile = path.join(root, 'data', 'store.json'), generatedDir = path.join(root, 'generated');
if (!fs.existsSync(storeFile)) process.exit(0);
const store = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
const testUsers = store.users.filter((user) => String(user.name || '').startsWith('[系统测试]'));
const testIds = new Set(testUsers.map((user) => user.id));
const filenames = [...testIds].flatMap((id) => (store.data[id]?.versions || []).map((version) => version.filename));
store.users = store.users.filter((user) => !testIds.has(user.id));
store.sessions = store.sessions.filter((session) => !testIds.has(session.userId));
for (const id of testIds) delete store.data[id];
const temp = `${storeFile}.${process.pid}.tmp`;
fs.writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8');
fs.renameSync(temp, storeFile);
for (const filename of filenames) {
  const target = path.resolve(generatedDir, path.basename(filename));
  if (path.dirname(target) === generatedDir && fs.existsSync(target)) fs.rmSync(target);
}
console.log(JSON.stringify({ removedTestUsers: testUsers.length, removedGeneratedFiles: filenames.length }));
