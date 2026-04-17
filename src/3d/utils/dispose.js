import * as THREE from "three";

export function disposeObject3D(obj) {
  if (!obj) return;

  obj.traverse(child => {
    if (child?.geometry) {
      child.geometry.dispose?.();
    }

    const material = child?.material;
    if (material) {
      if (Array.isArray(material)) {
        material.forEach(m => disposeMaterial(m));
      } else {
        disposeMaterial(material);
      }
    }
  });
}

function disposeMaterial(material) {
  if (!material) return;

  // dispose textures
  Object.keys(material).forEach(key => {
    const value = material[key];
    if (value && value.isTexture) {
      value.dispose?.();
    }
  });

  material.dispose?.();
}

export function setMaterialsTransparent(obj, enabled, opacity = 0.35) {
  if (!obj) return;
  obj.traverse(child => {
    if (!child?.isMesh) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    mats.filter(Boolean).forEach(m => {
      m.transparent = Boolean(enabled);
      m.opacity = enabled ? opacity : 1;
      m.depthWrite = !enabled;
      m.needsUpdate = true;
    });
  });
}

export function computeBounds(obj) {
  const box = new THREE.Box3();
  box.setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { box, size, center };
}
