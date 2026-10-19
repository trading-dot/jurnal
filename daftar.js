import * as F from './firebase.js';
import { emailAllowed, norm } from './access.js';
import { $, box, setErr, guard, route, google, isBusy, NOT_CUSTOMER } from './auth-ui.js';
const { auth } = F;
function form() {
  box(`<div class="login"><h1>Daftar</h1><p class="mu">Pakai email yang sama saat pembelian.</p>
  <input id="em" type="email" placeholder="Email" autocomplete="email"><input id="p1" type="password" placeholder="Password (min. 6 karakter)" autocomplete="new-password">
  <input id="p2" type="password" placeholder="Ulangi password" autocomplete="new-password"><p class="neg" id="err"></p>
  <button class="pri" id="br">Daftar</button><p class="or">atau</p><button id="bg">Daftar dengan Google</button>
  <p class="sw">Sudah punya akun? <a href="login.html">Masuk</a></p></div>`);
  $('#br').onclick = () => guard(async () => {
    const email = norm($('#em').value), p1 = $('#p1').value, p2 = $('#p2').value; setErr('');
    if (!email) return setErr('Isi email dulu.');
    if (p1.length < 6) return setErr('Password minimal 6 karakter.');
    if (p1 !== p2) return setErr('Password dan ulangi password tidak sama.');
    if (await emailAllowed(email) === false) return setErr(NOT_CUSTOMER);
    const c = await F.createUserWithEmailAndPassword(auth, email, p1);
    await F.sendEmailVerification(c.user);
    await route(c.user, form);
  });
  $('#bg').onclick = () => google(form);
  $('#p2').onkeydown = e => { if (e.key === 'Enter') $('#br').click(); };
}
F.onAuthStateChanged(auth, u => { if (!isBusy()) route(u, form); });
