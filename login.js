import * as F from './firebase.js';
import { $, box, setErr, setMsg, guard, route, google, isBusy } from './auth-ui.js';
const { auth } = F;
function form() {
  box(`<div class="login"><h1>Masuk</h1><p class="mu">Catat, evaluasi, konsisten.</p>
  <input id="em" type="email" placeholder="Email" autocomplete="email"><input id="pw" type="password" placeholder="Password" autocomplete="current-password">
  <p class="neg" id="err"></p><p class="pos" id="msg"></p>
  <button class="pri" id="bl">Masuk</button><p class="or">atau</p><button id="bg">Masuk dengan Google</button>
  <button class="ghost" id="bf">Lupa password?</button>
  <p class="sw">Belum punya akun? <a href="daftar.html">Daftar</a></p></div>`);
  $('#bl').onclick = () => guard(async () => { await F.signInWithEmailAndPassword(auth, $('#em').value.trim(), $('#pw').value); await route(auth.currentUser, form); });
  $('#bg').onclick = () => google(form);
  $('#bf').onclick = () => guard(async () => { setErr(''); await F.sendPasswordResetEmail(auth, $('#em').value.trim()); setMsg('Link reset dikirim jika email terdaftar.'); });
  $('#pw').onkeydown = e => { if (e.key === 'Enter') $('#bl').click(); };
}
F.onAuthStateChanged(auth, u => { if (!isBusy()) route(u, form); });
