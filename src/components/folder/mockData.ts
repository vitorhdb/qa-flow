import { FileNode } from './FileTree';

export const mockProjectStructure: FileNode[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    path: 'src',
    children: [
      {
        id: '1-1',
        name: 'auth',
        type: 'folder',
        path: 'src/auth',
        children: [
          { id: '1-1-1', name: 'login.js', type: 'file', path: 'src/auth/login.js', language: 'javascript' },
          { id: '1-1-2', name: 'register.js', type: 'file', path: 'src/auth/register.js', language: 'javascript' },
          { id: '1-1-3', name: 'session.js', type: 'file', path: 'src/auth/session.js', language: 'javascript' },
        ],
      },
      {
        id: '1-2',
        name: 'api',
        type: 'folder',
        path: 'src/api',
        children: [
          { id: '1-2-1', name: 'users.js', type: 'file', path: 'src/api/users.js', language: 'javascript' },
          { id: '1-2-2', name: 'products.js', type: 'file', path: 'src/api/products.js', language: 'javascript' },
          { id: '1-2-3', name: 'orders.js', type: 'file', path: 'src/api/orders.js', language: 'javascript' },
        ],
      },
      {
        id: '1-3',
        name: 'components',
        type: 'folder',
        path: 'src/components',
        children: [
          { id: '1-3-1', name: 'Form.tsx', type: 'file', path: 'src/components/Form.tsx', language: 'javascript' },
          { id: '1-3-2', name: 'Table.tsx', type: 'file', path: 'src/components/Table.tsx', language: 'javascript' },
          { id: '1-3-3', name: 'Modal.tsx', type: 'file', path: 'src/components/Modal.tsx', language: 'javascript' },
        ],
      },
      {
        id: '1-4',
        name: 'utils',
        type: 'folder',
        path: 'src/utils',
        children: [
          { id: '1-4-1', name: 'helpers.js', type: 'file', path: 'src/utils/helpers.js', language: 'javascript' },
          { id: '1-4-2', name: 'validators.js', type: 'file', path: 'src/utils/validators.js', language: 'javascript' },
        ],
      },
    ],
  },
  {
    id: '2',
    name: 'database',
    type: 'folder',
    path: 'database',
    children: [
      { id: '2-1', name: 'schema.sql', type: 'file', path: 'database/schema.sql', language: 'sql' },
      { id: '2-2', name: 'migrations.sql', type: 'file', path: 'database/migrations.sql', language: 'sql' },
      { id: '2-3', name: 'seeds.sql', type: 'file', path: 'database/seeds.sql', language: 'sql' },
    ],
  },
  {
    id: '3',
    name: 'legacy',
    type: 'folder',
    path: 'legacy',
    children: [
      { id: '3-1', name: 'MainForm.pas', type: 'file', path: 'legacy/MainForm.pas', language: 'delphi' },
      { id: '3-2', name: 'DataModule.pas', type: 'file', path: 'legacy/DataModule.pas', language: 'delphi' },
    ],
  },
];

// Mock file contents for analysis
export const mockFileContents: Record<string, string> = {
  'src/auth/login.js': `
function login(username, password) {
  var query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  console.log("Logging in user:", username);
  return db.execute(query);
}
`,
  'src/auth/register.js': `
async function register(userData) {
  const { email, password } = userData;
  // TODO: Add email validation
  const hashedPassword = await bcrypt.hash(password);
  return db.users.create({ email, password: hashedPassword });
}
`,
  'src/auth/session.js': `
const sessionSecret = "super-secret-key-123";
function createSession(userId) {
  return jwt.sign({ userId }, sessionSecret);
}
`,
  'src/api/users.js': `
app.get('/users', (req, res) => {
  const userId = req.query.id;
  const query = "SELECT * FROM users WHERE id = " + userId;
  db.execute(query).then(result => res.json(result));
});
`,
  'src/api/products.js': `
async function getProducts(category) {
  try {
    return await db.products.find({ category });
  } catch (error) {
    // Silent fail
  }
}
`,
  'src/api/orders.js': `
function deleteOrder(orderId) {
  console.log("Deleting order:", orderId);
  // DANGER: No authorization check
  return db.execute("DELETE FROM orders WHERE id = " + orderId);
}
`,
  'database/schema.sql': `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  password VARCHAR(255)
);

-- TODO: Add indexes
DROP TABLE IF EXISTS temp_users;
`,
  'database/migrations.sql': `
-- Migration: Add admin user
INSERT INTO users (email, password) VALUES ('admin@test.com', 'admin123');
DELETE FROM logs;
`,
  'database/seeds.sql': `
INSERT INTO products (name, price) VALUES ('Test Product', 9.99);
TRUNCATE TABLE audit_logs;
`,
  'src/components/Form.tsx': `
const Form = ({ onSubmit }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    onSubmit(Object.fromEntries(formData));
  };
  return <form onSubmit={handleSubmit}>{/* fields */}</form>;
};
`,
  'src/components/Table.tsx': `
const Table = ({ data }) => {
  return (
    <table>
      {data.map((row, i) => (
        <tr key={i}>{/* cells */}</tr>
      ))}
    </table>
  );
};
`,
  'src/components/Modal.tsx': `
const Modal = ({ isOpen, children }) => {
  if (!isOpen) return null;
  return <div className="modal">{children}</div>;
};
`,
  'src/utils/helpers.js': `
function formatDate(date) {
  return date.toLocaleDateString();
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
`,
  'src/utils/validators.js': `
function isEmail(email) {
  return email.includes('@');
}

function isStrongPassword(password) {
  return password.length > 6;
}
`,
  'legacy/MainForm.pas': `
procedure TMainForm.btnLoginClick(Sender: TObject);
var
  SQL: string;
begin
  SQL := 'SELECT * FROM Users WHERE Username = ''' + edtUsername.Text + '''';
  Query1.SQL.Text := SQL;
  Query1.Open;
end;
`,
  'legacy/DataModule.pas': `
procedure TDataModule.DeleteAllRecords;
begin
  Query1.SQL.Text := 'DELETE FROM transactions';
  Query1.ExecSQL;
end;
`,
};
