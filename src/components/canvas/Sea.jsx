import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import { useFrame } from '@react-three/fiber'
import { useCursor, MeshDistortMaterial, Stats, PerspectiveCamera } from '@react-three/drei'
import { Color, Vector2, Vector3, Vector4 } from 'three'

import { useControls } from 'leva'

import VertexShader from './VertexShader';
import FragmentShader from './FragmentShader';
import { LinearToSRGB } from 'three/src/math/ColorManagement'


const Sea = () => {
  const camera = useControls("camera", { 
    x: 0.0, y: 0.75, z: 0.0
  })

  const lookat = useControls('lookat', {
    x: -125.0, y: 25.0, z: -95.0
  })

  const lightDir = useControls('lightDir', {
    x: -1.0, y: 0.8, z: -1.0
  })

  const lightColour = useControls('lightColour', 
    { r: 1.4, g: 0.8, b: 0.4 })

  const surface = useControls('surface', {
    specular: 6.0,
    specularHardness: 512.0,
    diffuse: 0.1,
    attenDepth: -0.52,
    attenScale: 0.2
  })

  const global = useControls('global', {
    fog: 0.175,
    reflections: true,
    postEffects: true,
    moveCamera: true,
    param: 0.2 })


  // This reference will give us direct access to the mesh
  const mesh = useRef();

  const firstTime = useMemo(() => Date.now(), []);

  const uniforms = useMemo(
    () => {
      let l = lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z;
      let len = 1.0 / Math.sqrt(l);

      return  {
        time: { value:  Date.now() - firstTime }, 
        resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
        cameraPos: { value: new Vector3(camera.x, camera.y, camera.z) },
        cameraLookAt: { value: new Vector3(lookat.x, lookat.y, lookat.z) },
        lightDir: { value: new Vector3(lightDir.x * len, lightDir.y * len, lightDir.z * len) },
        lightColour: { value: new Vector3(lightColour.r, lightColour.g, lightColour.b) },
        specular: { value: surface.specular },
        specularHardness: { value: surface.specularHardness },
        diffuse: { value: new Vector3(surface.diffuse,
          surface.diffuse, surface.diffuse) },
        moveCamera: { value: global.moveCamera },
        postEffects: { value: global.postEffects },
        reflections: { value: global.reflections },
        fog: { value: global.fog },
        attenDepth: { value: surface.attenDepth },
        attenScale: { value: surface.attenScale },
        param: { value: global.param }
      }
    }, [lightDir, camera, surface, global, lightColour, lookat, firstTime]
  );

  useFrame((state) => {
    const { clock } = state;
    mesh.current.material.uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <PerspectiveCamera position={[camera.x, camera.y, camera.z]}
    lookAt={[ lookat.x, lookat.y, lookat.z ]}>
      <mesh ref={mesh} position={[0, 0, 0]}  rotation={[-Math.PI / 2, 0, 0]} scale={1.5}>
        <planeGeometry args={[100, 100]} />
        <shaderMaterial
          fragmentShader={FragmentShader} 
          vertexShader={VertexShader}
          uniforms={uniforms}
        />

        <Stats />
      </mesh>
    </PerspectiveCamera>
  );
};

export default Sea;
