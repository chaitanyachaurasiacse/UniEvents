import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ShieldCheck } from "lucide-react";
import { api } from "../api";

// Public page: anyone with the link can view and check a certificate. It prints cleanly to PDF.
export function Certificate() {
  const { code } = useParams();
  const [c, setC] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api.get(`/certificates/${code}`).then((x) => setC(x.certificate)).catch((e) => setError(e.message));
  }, [code]);
  const long = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const url = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="cert-page">
      <div className="cert-bar no-print">
        <Link to="/" className="brand">
          <span className="brand-mark" /> UniEvents
        </Link>
        {c && (
          <button className="btn primary" onClick={() => window.print()}>
            <Printer size={16} /> Print or save as PDF
          </button>
        )}
      </div>
      {error ? (
        <div className="empty" style={{ maxWidth: 560, margin: '40px auto' }}>
          <h3>Certificate not found</h3>
          <span>{error} Check the code and try again.</span>
        </div>
      ) : !c ? (
        <div className="loading" style={{ maxWidth: 900, margin: '40px auto', minHeight: 560 }} />
      ) : (
        <>
          <div className="certificate">
            <div className="seal">VERIFIED</div>
            <small>Certificate of participation</small>
            <h1>{c.event}</h1>
            <p>This is to certify that</p>
            <div className="name">{c.student}</div>
            {c.rollNumber && <p className="cert-roll">Roll no. {c.rollNumber}</p>}
            <p>
              {c.department ? `of ${c.department}, ` : ''}participated in <b>{c.event}</b>, organised by {c.host} at {c.venue} on {long(c.date)}, and was
              marked present at the venue by QR ticket check-in.
            </p>
            <div className="sig">
              <div>
                Organised by
                <br />
                <b>{c.host}</b>
              </div>
              <QRCodeSVG value={url} size={84} level="M" />
              <div>
                Office of Student Affairs
                <br />
                <b>Babu Banarasi Das University</b>
              </div>
            </div>
            <code>Certificate {c.code} · check at {url}</code>
          </div>
          <p className="center muted small no-print" style={{ marginTop: 14, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <ShieldCheck size={15} /> Issued from attendance records. Scanning the QR code opens this page to confirm it is genuine.
          </p>
        </>
      )}
    </div>
  );
}
