/**
 * 视锥裁剪工具
 * 基于相机视锥快速过滤可见 mesh，减少 raycast / traverse 的无效遍历
 */
import * as THREE from "three";

const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

function isObjectVisibleInHierarchy(obj) {
  for (let current = obj; current; current = current.parent) {
    if (current.visible === false) return false;
  }
  return true;
}

/**
 * 返回在相机视锥内的 mesh 子集（基于 boundingSphere 快速剔除）
 * @param {THREE.Mesh[]} meshes - 待检查的 mesh 列表
 * @param {THREE.Camera} camera - 当前相机
 * @returns {THREE.Mesh[]}
 */
export function getVisibleMeshes(meshes, camera) {
  if (!meshes?.length || !camera) return meshes || [];

  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  const visible = [];
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    if (!isObjectVisibleInHierarchy(mesh)) continue;

    const geo = mesh.geometry;
    if (!geo) {
      visible.push(mesh);
      continue;
    }

    if (!geo.boundingSphere) {
      geo.computeBoundingSphere();
    }

    if (!geo.boundingSphere) {
      // 无法确定包围球 → 保守保留
      visible.push(mesh);
      continue;
    }

    _sphere.copy(geo.boundingSphere);
    _sphere.applyMatrix4(mesh.matrixWorld);

    if (_frustum.intersectsSphere(_sphere)) {
      visible.push(mesh);
    }
  }

  return visible;
}
