import Image from "next/image";
import Link from "next/link";
import nexoLogo from "../nexo.png";

export default function LandingPage() {
  return <main className="nexo-landing">
    <div aria-hidden="true" className="nexo-landing-aurora"><i /><i /></div>
    <nav className="nexo-landing-nav"><Link href="/landing" className="nexo-landing-mark"><Image alt="Nexo" src={nexoLogo} /> <span>Nexo</span></Link><div><a href="#product">Product</a><a href="#developer">Developer</a><Link className="nexo-landing-enter" href="/">Enter Nexo</Link></div></nav>
    <section className="nexo-landing-hero"><div className="nexo-landing-copy"><p className="nexo-landing-kicker">SOCIAL, SIGNED, YOURS</p><h1>A social layer built for people who own their identity.</h1><div className="nexo-landing-intro"><p>Nexo brings posts, groups, stories, live video, messaging, pages and marketplace into one social space. Everyday activity stays fast off-chain; identity and proof stay verifiable.</p><Link className="nexo-landing-cta" href="/">Create your account <span>→</span></Link></div></div></section>
    <section className="nexo-landing-grid" id="product"><article><span>01</span><h2>Social by default</h2><p>Publish, connect, chat, gather a community and go live without turning every interaction into a transaction.</p></article><article><span>02</span><h2>Proof when it matters</h2><p>Wallet identity, app signers, content anchors and non-transferable badges bring ownership where it adds value.</p></article><article><span>03</span><h2>Built to evolve</h2><p>On-chain actions complement the product. They do not get in the way of using it.</p></article></section>
    <section className="nexo-landing-developer" id="developer"><div><p className="nexo-landing-kicker">THE BUILDER</p><h2>Designed and developed by Daniel Olan.</h2></div><p>Nexo is an independent product by Daniel Olan: a practical exploration of how social software, real-time interaction and Ethereum identity can work together without sacrificing usability.</p></section>
    <footer className="nexo-landing-footer"><span>© {new Date().getFullYear()} Nexo</span><span>Built by Daniel Olan</span><Link href="/">Open the network →</Link></footer>
  </main>;
}
