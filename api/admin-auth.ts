import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Read service role key from server-side env (NOT exposed to client)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }));
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server misconfigured: missing VITE_SUPABASE_URL' }));
    return;
  }

  // Read body
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let payload: { action: string; [key: string]: any };
  try {
    payload = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    switch (payload.action) {
      case 'signup': {
        const { email, password, fullName, role } = payload;
        if (!email || !password) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Email and password are required' }));
          return;
        }
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || '', role: role || 'coach' },
        });
        if (error) throw error;

        // Also create/update the profile
        if (data?.user) {
          await adminClient.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName || email.split('@')[0],
            role: role || 'coach',
          });
        }

        res.statusCode = 200;
        res.end(JSON.stringify({ user: data?.user }));
        return;
      }

      case 'update': {
        const { userId, email, password } = payload;
        if (!userId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'userId is required' }));
          return;
        }
        const updateData: any = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        if (Object.keys(updateData).length > 0) {
          const { error } = await adminClient.auth.admin.updateUserById(userId, updateData);
          if (error) throw error;
        }

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      case 'delete': {
        const { userId } = payload;
        if (!userId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'userId is required' }));
          return;
        }
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) throw error;

        res.statusCode = 200;
        res.end(JSON.stringify({ success: true }));
        return;
      }

      default:
        res.statusCode = 400;
        res.end(JSON.stringify({ error: `Unknown action: ${payload.action}` }));
    }
  } catch (err: any) {
    console.error('Admin auth error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
}
