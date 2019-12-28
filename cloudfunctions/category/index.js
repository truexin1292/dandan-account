// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

// 云函数入口函数
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  cloud.updateConfig({
    env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV,
  })
  // 初始化数据库
  const db = cloud.database({
    env: wxContext.ENV === 'local' ? 'release-wifo3' : wxContext.ENV,
  });
  const {
    id, categoryName, categoryIcon, description, flow,
    type, parentId, isSelectable, ids,
  } = event; 

  const _ = db.command;

  try {
    if (event.mode === 'add') {
      const res = await db.collection('DANDAN_NOTE_CATEGORY')
        .add({
          data: {
            categoryName,
            categoryIcon,
            description,
            flow: Number(flow),
            type: Number(type),
            parentId,
            isSelectable,
            createTime: db.serverDate(),
            openId: String(type) === '0' ? 'SYSTEM' : wxContext.OPENID,
            isDel: false,
          },
        });
      return {
        code: 1,
        data: res,
        message: '操作成功',
      }
    }

    if (event.mode === 'deleteByIdAndFlow') {
      const res = await db.collection('DANDAN_NOTE_CATEGORY').doc(id)
        .update({
          data: {
            isDel: true,
          },
        });

      if (res.stats.updated > 0) {
        // 这样就是异步删除了8?
        let afterCategoryId = 'others_sub'
        if (Number(flow) === 1) {
          afterCategoryId = 'income_others'
        }
        const updateRes = await db.collection('DANDAN_NOTE')
          .where({
            categoryId: id,
            isDel: false,
          }).update({
            data: {
              categoryId: afterCategoryId,
            },
          });

        return {
          code: 1,
          data: updateRes,
          message: '操作成功',
        };
      }

      return {
        code: 1,
        data: res,
        message: '操作成功',
      }
    }

    if (event.mode === 'getCategoryById') {
      const res = await db.collection('DANDAN_NOTE_CATEGORY')
        .where({
          _id: id,
          isDel: false,
        }).get();
      return {
        code: 1,
        data: res,
        message: '操作成功',
      };
    }

    if (event.mode === 'getCategoriesByIdBatch') {
      const res = await db.collection('DANDAN_NOTE_CATEGORY')
        .where({
          _id: _.in(ids),
          isDel: false,
        }).get();

      return {
        code: 1,
        data: res,
        message: '操作成功',
      };
    }

    // 根据父分类ID获取子分类ID
    if (event.mode === 'getCategoriesByParentCID') {
      const res = await db.collection('DANDAN_NOTE_CATEGORY')
        .where({
          parentId: id,
          isDel: false,
        }).get();
      return {
        code: 1,
        data: res,
        message: '操作成功',
      };
    }

    /**
     * 更新账单父分类记录 by 账单分类ID
     */
    if (event.mode === 'updateParentCategoryById') {
      const updateRes = await db.collection('DANDAN_NOTE_CATEGORY').doc(id)
        .update({
          data: {
            categoryName,
            categoryIcon,
            description,
            flow: Number(flow),
            type: Number(type),
            isSelectable,
          },
        });
      return {
        code: 1,
        data: updateRes,
        message: '操作成功',
      };
    }

    /**
     *  删除账单分类 by 账单分类ID
     */
    if (event.mode === 'deleteCategoryById') {
      let afterCategoryId = 'others_sub'
      if (Number(flow) === 1) {
        afterCategoryId = 'income_others'
      }

      const updateCategoryRes = db.collection('DANDAN_NOTE_CATEGORY').doc(id)
        .update({
          data: {
            isDel: true,
          },
        });

      //更新该用户某个子分类下的所有未删除账单分类改为杂项
      const updateRes = db.collection('DANDAN_NOTE')
        .where({
          categoryId: id,
          isDel: false,
          openId : wxContext.OPENID,
        })
        .update({
          data: {
            categoryId: afterCategoryId,
          },
        });
      return Promise.all([updateCategoryRes, updateRes]).then((result) => {
        return {
          code: 1,
          data: result,
          message: '操作成功',
        };
      }).catch((error) => {
        console.log(error)      // 失败了，打出 '失败'
      })
    }

    /**
     *  删除账单分类 by 账单分类ID AND 所有账单
     */
    if (event.mode === 'deleteCategoryByIdAndAll') {
      //获取被删除父分类下， 所有子分类的ID集合
      const categoryRes = await db.collection('DANDAN_NOTE_CATEGORY')
        .where({
          data: {
            parentId: id,
            isDel: true,
          },
        });
      //逻辑删除父分类
      const updateParentCategoryRes = db.collection('DANDAN_NOTE_CATEGORY').doc(id)
        .update({
          data: {
            isDel: true,
          },
        });
      //逻辑删除子分类
      const updateCategoryRes = db.collection('DANDAN_NOTE_CATEGORY')
        .where({
          parentId: id,
          isDel: false,
          openId: wxContext.OPENID,
        })
        .update({
          data: {
            isDel: true,
          },
        });
      //逻辑删除属于该子分类的账单
      const categoryIdArray = [];
      categoryRes.forEach(function (val, index, arr) {
        categoryIdArray.push(val._id);
      });
      const noteUpdateRes = db.collection('DANDAN_NOTE')
        .where({
          categoryId: _.in(categoryRes),
          isDel: false,
          openId: wxContext.OPENID,
        })
        .update({
          data: {
            isDel: true,
          },
        });
      return Promise.all([updateParentCategoryRes, updateCategoryRes, noteUpdateRes]).then((result) => {
        return {
          code: 1,
          data: result,
          message: '操作成功',
        };
      }).catch((error) => {
        console.log(error)      // 失败了，打出 '失败'
      })
    }

  } catch (e) {
    return {
      code: -1,
      data: '',
      message: '操作失败',
    };
  }
}
