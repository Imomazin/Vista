import type {Metadata} from 'next';
export const metadata:Metadata={title:'Analytics and Cookie Choices | VisTa',description:'How VisTa uses optional Google Analytics and how you can manage consent.',robots:{index:true,follow:true}};
export default function AnalyticsPrivacy(){
 return <main style={{maxWidth:800,margin:'0 auto',padding:'clamp(28px,5vw,70px) 22px',lineHeight:1.8,minHeight:'100vh'}}>
  <a href="/" style={{textDecoration:'underline',fontSize:13}}>Back to VisTa</a>
  <h1 style={{fontSize:'clamp(30px,5vw,48px)',margin:'38px 0 12px'}}>Analytics and cookie choices</h1>
  <p>VisTa is an Ambidexters marketing intelligence website. We aim to understand how visitors use public pages without requiring anyone to share their identity or using optional analytics cookies before consent.</p>
  <h2>What is optional?</h2>
  <p>If Google Analytics 4 is configured, it can help us understand aggregate visits, viewed pages, visitor sources and general device or browser information. Google Analytics is operated by Google. The GA4 script and optional analytics cookies are not activated unless you select <strong>Allow analytics</strong>.</p>
  <h2>What is essential?</h2>
  <p>VisTa uses strictly necessary application storage for your chosen appearance, browser workspaces and authenticated cloud sessions, where applicable. Those application features are separate from optional visitor analytics.</p>
  <h2>Your choice</h2>
  <p>You may reject analytics and still use VisTa's public features. Where analytics is configured, use the <strong>Analytics preferences</strong> control at the bottom of the page at any time to review and change your choice. Declining or withdrawing consent prevents new Google Analytics tracking. Previously collected data cannot necessarily be withdrawn from Google retroactively through this browser control.</p>
  <h2>Retention and transfers</h2>
  <p>Google may process information using infrastructure outside the UK. The applicable Google terms and privacy information govern that processing. We will publish the final data-retention configuration once the Ambidexters GA4 property has been provisioned.</p>
  <p style={{fontSize:12,opacity:.7,marginTop:40}}>This page explains optional website analytics. It does not replace VisTa's account privacy notices, customer contracts or data-processing agreements.</p>
 </main>;
}