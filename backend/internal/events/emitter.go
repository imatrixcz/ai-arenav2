package events

import "time"

type EventType string

const (
	EventSystemInitialized    EventType = "system.initialized"
	EventUserRegistered       EventType = "user.registered"
	EventUserVerified         EventType = "user.verified"
	EventUserLoggedIn         EventType = "user.logged_in"
	EventTenantCreated        EventType = "tenant.created"
	EventTenantDeleted        EventType = "tenant.deleted"
	EventMemberInvited        EventType = "member.invited"
	EventMemberJoined         EventType = "member.joined"
	EventMemberRemoved        EventType = "member.removed"
	EventMemberRoleChanged    EventType = "member.role_changed"
	EventOwnershipTransferred EventType = "member.ownership_transferred"
)

type Event struct {
	Type      EventType
	Timestamp time.Time
	Data      map[string]interface{}
}

type Emitter interface {
	Emit(event Event)
}

type NoopEmitter struct{}

func (n *NoopEmitter) Emit(_ Event) {}

func NewNoopEmitter() Emitter {
	return &NoopEmitter{}
}
