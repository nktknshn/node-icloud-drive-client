/* eslint-disable @typescript-eslint/no-empty-interface */
import { pipe } from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import * as T from 'fp-ts/lib/Tree'
import { TypeOf } from 'io-ts'
import { hasOwnProperty, isObjectWithOwnProperty } from '../../lib/util'
import * as t from './types-io'

export interface DetailsRoot extends TypeOf<typeof t.detailsRoot> {}
export interface DetailsFolder extends TypeOf<typeof t.detailsFolder> {}
export interface DetailsAppLibrary extends TypeOf<typeof t.detailsAppLibrary> {}
export interface DriveChildrenItemFolder extends TypeOf<typeof t.itemFolder> {}
export interface DriveChildrenItemFile extends TypeOf<typeof t.itemFile> {}
export interface DriveChildrenItemAppLibrary extends TypeOf<typeof t.itemAppLibrary> {}
export type DriveItemDetails = TypeOf<typeof t.itemDetails>

export interface Icon extends TypeOf<typeof t.icon> {}

export interface InvalidId extends TypeOf<typeof t.invalidIdItem> {}

export interface ItemNotFound {
  readonly tag: 'ItemNotFound'
  drivewsid: string
}

export type MaybeNotFound<T> = InvalidId | T

export const isNotInvalidId = <T>(i: T | InvalidId): i is T => !t.invalidIdItem.is(i)
export const isInvalidId = <T>(i: T | InvalidId): i is InvalidId => t.invalidIdItem.is(i)

export const asOption = <T>(i: T | InvalidId): O.Option<T> => isInvalidId(i) ? O.none : O.some(i)

export type DriveDetailsWithHierarchy =
  | DriveDetailsRootWithHierarchy
  | DriveDetailsAppLibraryWithHierarchy
  | DriveDetailsFolderWithHierarchy
// TypeOf<typeof t.detailsWithHierarchy>

export type DriveDetailsPartialWithHierarchy = TypeOf<typeof t.driveDetailsWithHierarchyPartial>

export interface DriveDetailsRootWithHierarchy extends TypeOf<typeof t.rootDetailsWithHierarchy> {}

export interface DriveDetailsFolderWithHierarchy extends TypeOf<typeof t.folderDetailsWithHierarchy> {}
export interface DriveDetailsAppLibraryWithHierarchy extends TypeOf<typeof t.appLibraryDetailsWithHierarchy> {}
export interface DriveDetailsRootPartialWithHierarchy extends TypeOf<typeof t.rootDetailsWithHierarchyPartial> {}

export interface DriveDetailsFolderPartialWithHierarchy extends TypeOf<typeof t.folderDetailsWithHierarchyPartial> {}

export interface DriveDetailsAppLibraryPartialWithHierarchy
  extends TypeOf<typeof t.appLibraryDetailsWithHierarchyPartial>
{}

// export interface DriveChildrenItem extends TypeOf<typeof t.childrenItem> {}

export type Hierarchy = TypeOf<typeof t.hierarchy>

export interface HierarchyItem extends TypeOf<typeof t.hierarchyItem> {}
export interface HierarchyRoot extends TypeOf<typeof t.hierarchyRoot> {}
export interface HierarchyTrash extends TypeOf<typeof t.hierarchyTrash> {}
export type HierarchyEntry = TypeOf<typeof t.hierarchyEntry>

export const isFileHierarchyEntry = (entry: HierarchyEntry) => entry.drivewsid.startsWith('FILE')
export const isFolderHierarchyEntry = (entry: HierarchyEntry) => entry.drivewsid.startsWith('FOLDER')

export const isFolderDrivewsid = (driwewsid: string) => driwewsid.startsWith('FOLDER')

export interface PartialItem extends TypeOf<typeof t.partialItem> {}

export type FolderTree = T.Tree<
  {
    readonly details: Details
    readonly deep: true
  } | {
    readonly details: Details
    readonly deep: false
  }
>

export type RecursiveFolder =
  | {
    readonly details: Details
    readonly deep: true
    readonly children: RecursiveFolder[]
  }
  | {
    readonly details: Details
    readonly deep: false
  }

export type Details =
  | DetailsRoot
  | DetailsFolder
  | DetailsAppLibrary

// export type DriveChildrenItem =
//   | DriveChildrenItemFile
//   | DriveChildrenItemFolder
//   | DriveChildrenItemAppLibrary

export type DriveChildrenItem = DriveChildrenItemFile | DriveChildrenItemFolder | DriveChildrenItemAppLibrary

export type DriveObject = {
  name: string
  extension?: string
  drivewsid: string
}

export const invalidId: InvalidId = { status: 'ID_INVALID' as const }

export const isRootDetails = (details: Details | DriveChildrenItem): details is DetailsRoot =>
  details.name === '' && details.drivewsid === t.rootDrivewsid

export const isNotRootDetails = (details: Details | DriveChildrenItem): details is
  | DetailsFolder
  | DetailsAppLibrary => !isRootDetails(details)

export type DriveFolderLike =
  | DetailsFolder
  | DetailsAppLibrary
  | DetailsRoot
  | DriveChildrenItemFolder
  | DriveChildrenItemAppLibrary

export const isFolderLike = (
  entity: Details | DriveChildrenItem,
): entity is DriveFolderLike => entity.type === 'APP_LIBRARY' || entity.type === 'FOLDER'

export const partitionFoldersFiles = (
  items: DriveChildrenItem[],
): {
  readonly left: (DriveChildrenItemFolder | DriveChildrenItemAppLibrary)[]
  readonly right: DriveChildrenItemFile[]
} =>
  pipe(items, A.partition(isFileItem), ({ left, right }) => ({
    left: left as (DriveChildrenItemFolder | DriveChildrenItemAppLibrary)[],
    right,
  }))

export const isDetails = (
  entity: Details | DriveChildrenItem,
): entity is
  | DetailsFolder
  | DetailsAppLibrary
  | DetailsRoot => isFolderLike(entity) && isObjectWithOwnProperty(entity, 'items')

export const isFileItem = (
  entity: DriveChildrenItem,
): entity is DriveChildrenItemFile => entity.type === 'FILE'

export const isFolderLikeItem = (
  entity: DriveChildrenItem,
): entity is FolderLikeItem => entity.type === 'APP_LIBRARY' || entity.type === 'FOLDER'

// export const isFolderLikeItem = (
//   entity: DriveChildrenItem,
// ): entity is FolderLikeItem => entity.type === 'APP_LIBRARY' || entity.type === 'FOLDER'

export const isAppLibraryItem = (
  entity: DriveChildrenItem,
): entity is DriveChildrenItemAppLibrary => entity.type === 'APP_LIBRARY'

export const isNotAppLibraryItem = (
  entity: DriveChildrenItem,
): entity is
  | DriveChildrenItemFile
  | DriveChildrenItemFolder => entity.type !== 'APP_LIBRARY'

export type FolderLikeItem =
  | DriveChildrenItemFolder
  | DriveChildrenItemAppLibrary

export const isFile = (
  entity: Details | DriveChildrenItem,
): entity is DriveChildrenItemFile => entity.type === 'FILE'

export const isHierarchyItemRoot = (
  item: HierarchyItem | HierarchyRoot | HierarchyTrash,
): item is HierarchyRoot => item.drivewsid === t.rootDrivewsid

export const isHierarchyItemTrash = (
  item: HierarchyItem | HierarchyRoot | HierarchyTrash,
): item is HierarchyTrash => item.drivewsid === t.trashDrivewsid
