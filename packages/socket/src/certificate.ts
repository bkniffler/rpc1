import * as forge from 'node-forge';

interface IGenerateCertificate {
  domain?: string;
  country?: string;
  state?: string;
  locality?: string;
  organization?: string;
  ou?: string;
}
export function generateCertificate({
  domain,
  country,
  state,
  locality,
  organization,
  ou
}: IGenerateCertificate = {}) {
  var pki = forge.pki;
  var keys = pki.rsa.generateKeyPair(2048);
  var cert = pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  var attrs = [];
  if (domain) {
    attrs.push({ name: 'commonName', value: domain });
  }
  if (country) {
    attrs.push({ name: 'countryName', value: country });
  }
  if (state) {
    attrs.push({ name: 'ST', value: state });
  }
  if (locality) {
    attrs.push({ name: 'localityName', value: locality });
  }
  if (organization) {
    attrs.push({ name: 'organizationName', value: organization });
  }
  if (ou) {
    attrs.push({ name: 'OU', value: ou });
  }

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  return {
    publicKey: pki.publicKeyToPem(keys.publicKey),
    cert: pki.certificateToPem(cert),
    privateKey: pki.privateKeyToPem(keys.privateKey)
  };
}
