import type {CamelCase, rxjs} from '@usevenice/util'
import {camelCase} from '@usevenice/util'
import type {
  AirbyteCatalog,
  AirbyteConnectionStatus,
  AirbyteControlMessage,
  AirbyteLogMessage,
  AirbyteRecordMessage,
  AirbyteTraceMessage,
  ConnectorSpecification,
  Type,
} from './airbyte-protocol.gen'

export type ABMessage<T extends Type = Type> = Extract<
  | {type: 'CATALOG'; catalog: AirbyteCatalog; [k: string]: unknown}
  | {
      type: 'CONNECTION_STATUS'
      connectionStatus: AirbyteConnectionStatus
      [k: string]: unknown
    }
  | {type: 'CONTROL'; control: AirbyteControlMessage; [k: string]: unknown}
  | {type: 'LOG'; log: AirbyteLogMessage; [k: string]: unknown}
  | {type: 'RECORD'; record: AirbyteRecordMessage; [k: string]: unknown}
  | {type: 'SPEC'; spec: ConnectorSpecification; [k: string]: unknown}
  | {type: 'STATE'; state: AirbyteCatalog; [k: string]: unknown}
  | {type: 'TRACE'; trace: AirbyteTraceMessage; [k: string]: unknown},
  {type: T}
>

/** Log & Trace are always allowed */
export type ABMessageStream<T extends Type = Type> = rxjs.Observable<
  ABMessage<T | 'LOG' | 'TRACE'>
>

export function abMessage<T extends Type>(
  type: T,
  payload: ABMessage<T>[CamelCase<T>],
) {
  return {type, [camelCase(type)]: payload} as ABMessage<T>
}
