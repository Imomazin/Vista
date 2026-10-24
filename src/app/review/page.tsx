import {notFound} from 'next/navigation';
import ReviewFrame from './review-frame';
export const dynamic='force-dynamic';
export default function Review(){if(process.env.VERCEL_ENV==='production')notFound();return <ReviewFrame/>;}
