const FragmentShader = `
#ifdef GL_ES
precision highp float;
#endif

uniform float time;
uniform vec2 resolution;
uniform vec3 cameraPos;
uniform vec3 cameraLookat;
uniform vec3 lightDir;
uniform vec3 lightColour;
uniform float specular;
uniform float specularHardness;
uniform float fog;
uniform vec3 diffuse;
uniform bool postEffects;
uniform bool moveCamera;
uniform bool reflections;
uniform float attenDepth;
uniform float attenScale;
uniform float param;

//#define AA

#define GAMMA 0.8
#define CONTRAST 1.1
#define SATURATION 1.3
#define BRIGHTNESS 1.3
#ifndef AA
#define NOISE_PASSES 6
#define RAY_DEPTH 256
#define MAX_DEPTH 200.0
#define DISTANCE_MIN 0.003
#else
#define ANTIALIAS_SAMPLES 16
#define NOISE_PASSES 8
#define RAY_DEPTH 256
#define MAX_DEPTH 200.0
#define DISTANCE_MIN 0.003
#endif
#define PI 3.14159265

const vec2 delta = vec2(DISTANCE_MIN, 0.);

float Hash(in float n)
{
    return fract(sin(n)*43758.5453123);
}

float Noise(in vec2 x)
{
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0;
    float res = mix(mix( Hash(n+  0.0), Hash(n+  1.0),f.x),
                    mix( Hash(n+ 57.0), Hash(n+ 58.0),f.x),f.y);
    return res;
}

const float cHashM = 43758.54;
vec4 Hashv4v3 (vec3 p)
{
  const vec3 cHashVA3 = vec3 (37.1, 61.7, 12.4);
  const vec3 e = vec3 (1., 0., 0.);
  return fract (sin (vec4 (dot (p + e.yyy, cHashVA3), dot (p + e.xyy, cHashVA3),
     dot (p + e.yxy, cHashVA3), dot (p + e.xxy, cHashVA3))) * cHashM);
}
float Noisefv3a (vec3 p)
{
  vec3 i, f;
  i = floor (p);  f = fract (p);
  f *= f * (3. - 2. * f);
  vec4 t1 = Hashv4v3 (i);
  vec4 t2 = Hashv4v3 (i + vec3 (0., 0., 1.));
  return mix (mix (mix (t1.x, t1.y, f.x), mix (t1.z, t1.w, f.x), f.y),
              mix (mix (t2.x, t2.y, f.x), mix (t2.z, t2.w, f.x), f.y), f.z);
}
float Fbm3 (vec3 p)
{
  const mat3 mr = mat3 (0., 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64);
  float f, a, am, ap;
  f = 0.;  a = 0.5;
  am = 0.5;  ap = 4.;
  p *= 0.5;
  for (int i = 0; i < 6; i ++) {
    f += a * Noisefv3a (p);
    p *= mr * ap;  a *= am;
  }
  return f;
}

//	FAST32_hash
//	A very fast hashing function.  Requires 32bit support.
//	http://briansharpe.wordpress.com/2011/11/15/a-fast-and-simple-32bit-floating-point-hash-function/
void FAST32_hash_2D( vec2 gridcell, out vec4 hash_0, out vec4 hash_1 )
{
   // gridcell is assumed to be an integer coordinate
   const vec2 OFFSET = vec2( 26.0, 161.0 );
   const float DOMAIN = 71.0;
   const vec2 SOMELARGEFLOATS = vec2( 951.135664, 642.949883 );
   vec4 P = vec4( gridcell.xy, gridcell.xy + 1.0 );
   P = P - floor(P * ( 1.0 / DOMAIN )) * DOMAIN;
   P += OFFSET.xyxy;
   P *= P;
   P = P.xzxz * P.yyww;
   hash_0 = fract( P * ( 1.0 / SOMELARGEFLOATS.x ) );
   hash_1 = fract( P * ( 1.0 / SOMELARGEFLOATS.y ) );
}

vec2 Interpolation_C2( vec2 x ) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

//	Perlin Noise 2D  ( gradient noise )
//	Return value range of -1.0->1.0
//	http://briansharpe.files.wordpress.com/2011/11/perlinsample.jpg
float Perlin2D( vec2 P )
{
    //	establish our grid cell and unit position
    vec2 Pi = floor(P);
    vec4 Pf_Pfmin1 = P.xyxy - vec4( Pi, Pi + 1.0 );

    //	calculate the hash.
    vec4 hash_x, hash_y;
    FAST32_hash_2D( Pi, hash_x, hash_y );

    //	calculate the gradient results
    vec4 grad_x = hash_x - 0.49999;
    vec4 grad_y = hash_y - 0.49999;
    vec4 grad_results = inversesqrt( grad_x * grad_x + grad_y * grad_y ) * ( grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww );

    //	Classic Perlin Interpolation
    grad_results *= 1.4142135623730950488016887242097;
    vec2 blend = Interpolation_C2( Pf_Pfmin1.xy );
    vec4 blend2 = vec4( blend, vec2( 1.0 - blend ) );
    return dot( grad_results, blend2.zxzx * blend2.wwyy );
}

// Octave transform matrix from Alexander Alekseev aka TDM 
mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);

// FBM Noise - mixing Value noise and Perlin Noise - also ridged turbulence at smaller octaves
float FractalNoise(in vec2 xy)
{
   float m = 1.25;
   float w = 0.65;
   float f = 0.0;
   for (int i = 0; i < NOISE_PASSES; i++)
   {
      f += Noise (xy.xy+time*0.655) * m * 0.25;
      if (i < 2)
      {
         f += Perlin2D(xy.yx-time*0.233) * w * 0.12;
      }
      else
      {
         // ridged turbulence at smaller scales - moves 4x faster
         f += abs(Perlin2D(xy.yx-time*0.932) * w * 0.05)*1.75;
      }
      w *= 0.45;
      m *= 0.35;
      xy *= octave_m;
   }
   return f;
}

float Dist(vec3 pos)
{
   return dot(pos-vec3(0.,-FractalNoise(pos.xz),0.), vec3(0.,1.,0.));
}

vec3 GetNormal(vec3 pos)
{
   vec3 n;
   n.x = Dist( pos + delta.xyy ) - Dist( pos - delta.xyy );
   n.y = Dist( pos + delta.yxy ) - Dist( pos - delta.yxy );
   n.z = Dist( pos + delta.yyx ) - Dist( pos - delta.yyx );

   return normalize(n);
}

vec3 Sky(in vec3 rd)
{
   float sunAmount = max(dot(rd, lightDir), 0.0);
   float v = pow(1.0 - max(rd.y,0.0),6.);
   vec3 sky = mix(vec3(0.15, 0.2, 0.4), vec3(0.32,0.32,0.35), v);

   return clamp(sky, 0.0, 1.0);

// TODO: blue/greyish sky - clouds for ref? look at poole photos!
// TODO: foam on tips?

   // background sky     
   // 0.48,0.72,0.80  0.25,0.52,0.62
   /*vec3 col = 0.9 * vec3(0.45,0.45,0.50) - rd.y*vec3(0.25,0.52,0.62);
   col = mix(col, vec3(0.65,0.65,0.655), 0.5);

   // sun glare    
   float sun = clamp( dot(lightDir,rd), 0.0, 1.0 );
   col += 0.6*vec3(1.0,0.6,0.3)*pow( sun,400.0 );

   return col;*/
}

// Volumetric Clouds from David Hoskins original
vec3 SkyClouds(vec3 ro, vec3 rd)
{
   float fCloud = 0.6 + (sin(time*0.05)*0.2);

   const vec3 cCol1 = 0.5 * vec3 (0.15, 0.2, 0.4),
   cCol2 = 0.5 * vec3 (0.25, 0.5, 0.7);
   vec3 cloudDisp = 10. * time * vec3 (1., 0., 1.);
   vec3 p, q, cSun, skyBg, clCol, col;
   float colSum, attSum, s, att, a, dDotS, ds;
   const float cloudLo = 100., cloudRngI = 1./50., atFac = 0.06;
   const int nLay = 22;
   fCloud = clamp (fCloud, 0., 1.);
   dDotS = max (dot (rd, lightDir), 0.);
   ro += cloudDisp;
   p = ro;
   p.xz += (cloudLo - p.y) * rd.xz / rd.y;
   p.y = cloudLo;
   ds = 1. / (cloudRngI * rd.y * (2. - rd.y) * float (nLay));
   colSum = 0.;  attSum = 0.;
   s = 0.;  att = 0.;
   for (int j = 0; j < nLay; j ++) {
      q = p + rd * s;
      q.z *= 0.7;
      att += atFac * max (fCloud - Fbm3 (0.02 * q), 0.);
      a = (1. - attSum) * att;
      colSum += a * (q.y - cloudLo) * cloudRngI;
      attSum += a;  s += ds;
      if (attSum >= 1.) break;
   }
   colSum += 0.5 * min ((1. - attSum) * pow (dDotS, 3.), 1.);
   clCol = vec3 (1.) * colSum + 0.05 * lightColour;
   cSun = lightColour * clamp ((min (pow (dDotS, 1500.) * 2., 1.) +
   min (pow (dDotS, 10.) * 0.75, 1.)), 0., 1.);
   skyBg = mix (cCol1, cCol2, 1. - rd.y);
   col = clamp (mix (skyBg + cSun, 1.6 * clCol, attSum), 0., 1.);

   col = mix(col, vec3(0.35, 0.35, 0.38), clamp(min(1.0, 1.0-(rd.y*4.0)),0.0,1.0));
   return col;
}

// Fog routine - original by IQ
vec3 Fog(vec3 rgb, vec3 ro,  vec3 rd, float distance)
{
   float fogAmount = 1.0 - exp(-distance*fog*fog);
   vec3  fogColor = SkyClouds(ro, rd);
   return mix(rgb, fogColor, fogAmount);
}

const vec3 WATER_COLOR = vec3(0.6,0.75,0.65);
vec3 Shading(vec3 pos, vec3 rd, vec3 norm, vec3 ro)
{
   vec3 light = lightColour * max(0.0, dot(norm, lightDir));
   vec3 view = normalize(-rd);
   vec3 heading = normalize(view + lightDir);
   float spec = pow(max(0.0, dot(heading, norm)), specularHardness);

   float cloudSpecular = 0.1 + (4.0 - (sin(time*0.05)*4.0));

   float fresnel = 0.0;
   if (reflections)
   {
      fresnel = pow(1.0 - dot(view, norm), 5.0);
      fresnel = mix(0.0, 1.0, min(1.0, fresnel));
   }

   light = (diffuse * light) + (spec * cloudSpecular * lightColour) * (1.0-fresnel);

   if (fresnel > 0.0)
   {
      vec3 refrd = reflect(rd, norm);
      light += SkyClouds(ro, refrd) * fresnel;
   }

   // attenuation
   vec3 dist = pos - ro;
   float atten = max(1.0 - dot(dist,dist) * 0.0001, 0.0);
   light += WATER_COLOR * (pos.y - attenDepth) * attenScale * atten;

   light = Fog(light, ro, rd, length(ro-pos));

   // TODO: Cloud shadows!

   return light;
}

// Original method by David Hoskins
vec3 PostEffects(vec3 rgb, vec2 xy)
{
   rgb = pow(rgb, vec3(GAMMA));
   rgb = mix(vec3(.5), mix(vec3(dot(vec3(.2125, .7154, .0721), rgb*BRIGHTNESS)), rgb*BRIGHTNESS, SATURATION), CONTRAST);
   rgb *= .4+0.5*pow(40.0*xy.x*xy.y*(1.0-xy.x)*(1.0-xy.y), 0.2 ); 
   return rgb;
}

// Camera function by TekF
// Compute ray from camera parameters
vec3 GetRay(vec3 dir, vec2 pos)
{
   pos = pos - 0.5;
   pos.x *= resolution.x/resolution.y;

   dir = normalize(dir);
   vec3 right = normalize(cross(vec3(0.,1.,0.),dir));
   vec3 up = normalize(cross(dir,right));

   return dir + right*pos.x + up*pos.y;
}

vec4 March(vec3 ro, vec3 rd)
{
   float t = 0.0;
   float d = 1.0;
   for (int i=0; i<RAY_DEPTH; i++)
   {
      vec3 p = ro + rd * t;
      d = Dist(p);
      if (abs(d) < DISTANCE_MIN)
      {
         return vec4(p, 1.0);
      }
      t += d;
      if (t >= MAX_DEPTH) break;
   }
   return vec4(0.0);
}

void main()
{
   vec3 off = vec3(0.0);
   if (moveCamera) off.z -= time*0.25;
   vec4 res = vec4(0.0);

#ifndef AA
   vec2 p = gl_FragCoord.xy / resolution.xy;
   vec3 ro = cameraPos + off;
   vec3 rd = normalize(GetRay((cameraLookat-off)-cameraPos+off, p));

   res = March(ro, rd);
   if (res.a == 1.0) res.rgb = Shading(res.rgb, rd, GetNormal(res.rgb), ro).rgb;
   else res.rgb = SkyClouds(ro, rd);
#else
   vec2 p;
   float d_ang = 2.*PI / float(ANTIALIAS_SAMPLES);
   float ang = d_ang * 0.33333;
   float r = 0.3;
   for (int i = 0; i < ANTIALIAS_SAMPLES; i++)
   {
      p = vec2((gl_FragCoord.x + cos(ang)*r) / resolution.x, (gl_FragCoord.y + sin(ang)*r) / resolution.y);
      vec3 ro = cameraPos + off;
      vec3 rd = normalize(GetRay((cameraLookat-off)-cameraPos+off, p));

      vec4 _res = March(ro, rd);
      if (_res.a == 1.0) _res.rgb = Shading(_res.rgb, rd, GetNormal(_res.rgb), ro).rgb;
      else _res.rgb = SkyClouds(ro, rd);
      ang += d_ang;
      res.rgb += _res.rgb;
   }
   res /= float(ANTIALIAS_SAMPLES);
#endif

   if (postEffects) res.rgb = PostEffects(res.rgb, p);

   gl_FragColor = vec4(res.rgb, 1.0);
}
`


export default FragmentShader
