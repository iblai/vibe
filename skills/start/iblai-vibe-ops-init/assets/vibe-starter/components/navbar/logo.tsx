'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/images/iblai-logo.png"
        alt="ibl.ai"
        width={120}
        height={40}
        className="h-6 w-auto sm:h-7 md:h-8"
        priority
      />
    </Link>
  );
}
