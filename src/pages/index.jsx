import dynamic from 'next/dynamic'
import Instructions from '@/components/dom/Instructions'
import { useState } from 'react'

// Dynamic import is used to prevent a payload when the website starts, that includes threejs, r3f etc..
// WARNING ! errors might get obfuscated by using dynamic import.
// If something goes wrong go back to a static import to show the error.
// https://github.com/pmndrs/react-three-next/issues/49
const Sea = dynamic(() => import('@/components/canvas/Sea'), { ssr: false })

// Dom components go here
export default function Page(props) {
  return (<div> 
  </div>)
}

// Canvas components go here
// It will receive same props as the Page component (from getStaticProps, etc.)
Page.canvas = (props) => <Sea />

    export async function getStaticProps() {
      return { props: { title: 'Index' } }
    }
