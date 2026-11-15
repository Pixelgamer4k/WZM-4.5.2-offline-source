/*
 * Report the original publisher certificate to this process.
 *
 * A re-signed copy is installed with a local key. The game asks PackageManager
 * for its own signer and exits when that key is not the publisher key. Gadget
 * loads this before the game's native library, so the hooks are in place
 * before that check. Queries for other packages are left alone.
 */
import Java from 'frida-java-bridge';

const PKG = 'com.activision.callofduty.warzone';
const ORIG_DER = [48,-126,3,123,48,-126,2,99,-96,3,2,1,2,2,4,33,124,-10,94,48,13,6,9,42,-122,72,-122,-9,13,1,1,11,5,0,48,109,49,11,48,9,6,3,85,4,6,19,2,85,83,49,11,48,9,6,3,85,4,8,19,2,67,65,49,19,48,17,6,3,85,4,7,19,10,70,111,115,116,101,114,67,105,116,121,49,12,48,10,6,3,85,4,11,19,3,65,80,77,49,19,48,17,6,3,85,4,10,19,10,65,99,116,105,118,105,115,105,111,110,49,25,48,23,6,3,85,4,3,19,16,74,111,97,107,105,109,66,114,117,110,110,101,115,116,111,109,48,32,23,13,50,50,48,56,49,49,49,50,48,49,53,55,90,24,15,50,48,53,55,48,56,48,50,49,50,48,49,53,55,90,48,109,49,11,48,9,6,3,85,4,6,19,2,85,83,49,11,48,9,6,3,85,4,8,19,2,67,65,49,19,48,17,6,3,85,4,7,19,10,70,111,115,116,101,114,67,105,116,121,49,12,48,10,6,3,85,4,11,19,3,65,80,77,49,19,48,17,6,3,85,4,10,19,10,65,99,116,105,118,105,115,105,111,110,49,25,48,23,6,3,85,4,3,19,16,74,111,97,107,105,109,66,114,117,110,110,101,115,116,111,109,48,-126,1,34,48,13,6,9,42,-122,72,-122,-9,13,1,1,1,5,0,3,-126,1,15,0,48,-126,1,10,2,-126,1,1,0,-67,67,73,75,108,-90,-9,20,64,-9,-62,77,-102,-116,86,116,62,123,-34,41,66,71,-11,76,-43,28,-74,-5,-50,-56,-49,-61,-44,18,-60,-32,38,-31,-79,-74,-121,69,6,-89,110,-120,-101,50,34,-18,30,-93,-7,-105,-47,67,27,58,-61,82,-18,72,24,11,64,50,-10,-108,45,-23,1,76,1,5,92,-118,-16,-127,-26,33,-60,-16,-7,-87,-77,-48,3,78,42,13,-66,2,-78,16,-106,-29,41,12,-99,123,8,36,30,-121,4,-94,16,-63,30,85,-114,26,-104,48,28,-80,81,-57,105,60,-4,-84,75,31,-88,-23,19,29,-89,5,82,16,67,51,11,13,29,-13,43,5,-4,34,37,27,-6,2,-95,-42,-28,-4,71,-15,-1,2,-42,-85,-17,32,-117,-88,-72,81,94,114,81,-121,42,-74,66,61,79,55,-121,-41,72,38,-64,118,49,-122,-41,75,69,-10,2,8,116,-63,24,-124,-102,53,31,-86,-82,72,28,-125,-125,-11,33,81,23,19,-21,-105,75,-1,93,-87,19,37,-93,-4,75,12,-50,26,-114,-65,-64,98,31,-94,94,-56,46,45,-42,44,104,10,67,68,-92,-1,-54,-59,-3,-9,8,-20,-98,-94,-57,80,100,-51,-82,-64,112,-11,-12,114,-60,-29,2,3,1,0,1,-93,33,48,31,48,29,6,3,85,29,14,4,22,4,20,-93,-110,35,-18,-96,76,72,116,37,6,-62,63,25,-83,-10,100,110,42,62,-30,48,13,6,9,42,-122,72,-122,-9,13,1,1,11,5,0,3,-126,1,1,0,-90,-15,-83,59,119,-99,-42,-34,-40,47,70,56,-105,100,-7,-18,-49,62,-82,-118,-103,-47,9,83,8,-128,24,115,24,-37,15,-35,6,-9,26,-56,26,-76,4,-64,26,122,19,90,-87,83,-24,111,124,-36,45,63,90,-105,115,-13,-25,114,33,31,88,99,-16,-52,-113,-108,31,116,-69,19,-70,83,32,80,28,-32,61,98,49,-117,75,-32,115,-90,124,-7,-61,30,121,15,-33,-7,-16,111,-27,103,63,67,-79,-108,2,88,-8,-50,-26,40,-63,-88,-38,22,29,90,-32,116,-125,-108,-62,-16,-30,-95,50,24,-107,17,-12,76,-40,64,-106,3,-120,45,-108,41,-21,-101,-10,-109,-97,44,84,65,-114,41,-88,-41,-122,-92,-69,-25,22,74,-34,-93,-53,110,-106,50,-103,86,82,83,84,107,-120,-36,34,33,-127,62,-42,-128,-68,-19,93,123,-44,10,45,-89,67,-127,63,13,-5,-59,49,85,-38,104,-40,-9,-36,-56,91,107,71,79,-74,-118,-48,20,20,-94,-114,-78,-46,-36,82,72,-107,31,-34,8,-56,84,9,124,-118,124,30,-8,-74,46,75,-13,119,24,-33,71,-77,-10,51,-21,29,-74,-7,-29,-23,22,34,124,-56,38,0,-87,-116,-114,-10,63,27,125,59,-122,-91,3];

let armed = false;
let armQueued = false;
// Identity hashes of SigningInfo objects that belong to this game only.
// Other packages keep the certificate the system returned.
const gameSigningInfos = new Set();

function log(message) {
  console.log('[WZM sig] ' + String(message).slice(0, 180));
}

function rememberGameSigningInfo(info) {
  const signingInfo = info.signingInfo;
  if (!signingInfo || signingInfo.value === null) return;
  gameSigningInfos.add(signingInfo.value.hashCode());
}

function isGameSigningInfo(self) {
  return gameSigningInfos.has(self.hashCode());
}

export function armSignatureSpoof() {
  // loadLibrary("gadget") runs inside GameApplication's static init. Hooking
  // Java on that same stack can re-enter class init and kill the boot.
  if (armed || armQueued) return;
  armQueued = true;
  setImmediate(tryArmSignatureSpoof);
}

function tryArmSignatureSpoof() {
  armQueued = false;
  if (armed) return;
  if (typeof Java === 'undefined' || !Java.available) {
    setTimeout(tryArmSignatureSpoof, 50);
    return;
  }
  Java.perform(() => {
    if (armed) return;
    try {
      const Signature = Java.use('android.content.pm.Signature');
      const bytes = Java.array('byte', ORIG_DER);
      const origSig = Signature.$new(bytes);
      function sigArray() {
        return Java.array('android.content.pm.Signature', [origSig]);
      }
      function spoofPackageInfo(info) {
        if (info === null) return;
        const name = info.packageName ? String(info.packageName.value) : '';
        if (name !== PKG) return;
        rememberGameSigningInfo(info);
        if (info.signatures !== undefined && info.signatures.value !== null)
          info.signatures.value = sigArray();
      }
      const PM = Java.use('android.app.ApplicationPackageManager');
      ['getPackageInfo', 'getPackageInfoAsUser'].forEach((name) => {
        if (!PM[name]) return;
        PM[name].overloads.forEach((ov) => {
          ov.implementation = function () {
            const info = ov.apply(this, arguments);
            try { spoofPackageInfo(info); } catch (e) { log('package info: ' + e); }
            return info;
          };
        });
      });
      try {
        const SI = Java.use('android.content.pm.SigningInfo');
        function hookSigningMethod(name, spoof) {
          if (!SI[name]) return;
          SI[name].overloads.forEach((ov) => {
            ov.implementation = function () {
              try {
                if (isGameSigningInfo(this)) return spoof();
              } catch (e) { log(name + ': ' + e); }
              return ov.apply(this, arguments);
            };
          });
        }
        hookSigningMethod('getApkContentsSigners', sigArray);
        hookSigningMethod('getSigningCertificateHistory', sigArray);
        hookSigningMethod('hasMultipleSigners', () => false);
        hookSigningMethod('hasPastSigningCertificates', () => false);
      } catch (e) { log('SigningInfo: ' + e); }
      try {
        const digest = Java.use('java.security.MessageDigest')
          .getInstance('SHA-256').digest(bytes);
        const ownUid = Java.use('android.os.Process').myUid();
        function sameBytes(a,b) {
          if (a === null || b === null || a === undefined || b === undefined ||
              a.length !== b.length) return false;
          let different = 0;
          for (let i = 0; i < a.length; i++)
            different |= (Number(a[i]) ^ Number(b[i])) & 255;
          return different === 0;
        }
        PM.hasSigningCertificate.overloads.forEach((ov) => {
          ov.implementation = function () {
            try {
              const first = arguments.length ? String(arguments[0]) : '';
              // Only report the authentic publisher certificate (raw DER or
              // its SHA-256), not arbitrary bytes for the user's app UID.
              // Android package/UID overloads both use cert[] and inputType.
              const isSelf = first === PKG ||
                (Number.isInteger(Number(first)) && Number(first) === ownUid);
              if (isSelf && arguments.length === 3) {
                const type = Number(arguments[2]);
                const expected = type === 0 ? bytes : type === 1 ? digest : null;
                if (expected !== null && sameBytes(arguments[1],expected))
                  return true;
              }
            } catch (e) { log('hasSigningCertificate: ' + e); }
            return ov.apply(this, arguments);
          };
        });
      } catch (e) { log('hasSigningCertificate: ' + e); }
      armed = true;
      log('publisher certificate hook ready');
      try { Java.use('android.util.Log').i('WZM', '[WZM sig] publisher certificate hook ready'); }
      catch (e) { log('logcat: ' + e); }
    } catch (e) {
      log('not armed: ' + e);
      setTimeout(tryArmSignatureSpoof, 200);
    }
  });
}
